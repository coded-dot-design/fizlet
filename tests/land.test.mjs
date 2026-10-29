// scripts/land.mjs: version bump, CHANGELOG conflict resolution, CI verdict.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bump, mergeChangelog, newer, verdict } from "../scripts/land.mjs";

const files = () => ({
  pkg: readFileSync("package.json", "utf8"),
  lock: readFileSync("package-lock.json", "utf8"),
  changelog: "# Changelog\n\n## Unreleased\n\n- new thing\n\n## 0.1.0\n\n- old\n",
});

test("bump: sets every version field, keeps formatting, renames Unreleased", () => {
  const f = files(), cur = JSON.parse(f.pkg).version;
  const [a, b, c] = cur.split(".").map(Number), next = `${a}.${b}.${c + 1}`;
  const out = bump(f, next);
  assert.equal(JSON.parse(out.pkg).version, next);
  const lock = JSON.parse(out.lock);
  assert.equal(lock.version, next);
  assert.equal(lock.packages[""].version, next);
  assert.equal(out.pkg.replace(`"version": "${next}"`, `"version": "${cur}"`), f.pkg, "only the version changed");
  assert.match(out.changelog, new RegExp(`^## ${next.replace(/\./g, "\\.")}\n\n- new thing`, "m"));
  assert.doesNotMatch(out.changelog, /Unreleased/);
});

test("bump: refuses a bad, old or same version and a CHANGELOG without Unreleased", () => {
  const f = files(), cur = JSON.parse(f.pkg).version;
  assert.throws(() => bump(f, "v1"), /not a version/);
  assert.throws(() => bump(f, cur), /not newer/);
  assert.throws(() => bump(f, "0.0.1"), /not newer/);
  assert.throws(() => bump({ ...f, changelog: "# Changelog\n\n## 0.1.0\n" }, "99.0.0"), /Unreleased/);
  assert.equal(newer("0.10.0", "0.9.9"), true, "numeric, not string, order");
});

test("changelog: the branch's Unreleased goes above main's new release", () => {
  const conflicted = [
    "# Changelog", "",
    "<<<<<<< HEAD", "## 0.4.0", "", "- presence", "", "=======", "## Unreleased", "", "- hardening", "", ">>>>>>> 76cf2ac (Harden)",
    "", "## 0.3.4", "", "- pad", "",
  ].join("\n");
  assert.equal(mergeChangelog(conflicted), "# Changelog\n\n## Unreleased\n\n- hardening\n\n## 0.4.0\n\n- presence\n\n\n## 0.3.4\n\n- pad\n");
});

test("changelog: the branch's side may repeat main's old entries (a stale base); anything else is refused", () => {
  const stale = "<<<<<<< HEAD\n## 0.4.0\n\n- presence\n\n## 0.3.4\n\n- pad\n=======\n## Unreleased\n\n- fix\n\n## 0.3.4\n\n- pad\n>>>>>>> abc\n";
  assert.equal(mergeChangelog(stale), "## Unreleased\n\n- fix\n\n## 0.4.0\n\n- presence\n\n## 0.3.4\n\n- pad\n");
  assert.throws(() => mergeChangelog("<<<<<<< HEAD\n## 0.4.0\n=======\n## 0.3.9\n- other\n>>>>>>> abc\n"), /by hand/);
  assert.throws(() => mergeChangelog("<<<<<<< HEAD\n## 0.4.0\n=======\n## Unreleased\n- a\n\n## 0.3.9\n- not on main\n>>>>>>> abc\n"), /by hand/);
  assert.equal(mergeChangelog("# no conflicts\n"), "# no conflicts\n");
});

test("ci verdict: green only when every run completed as success, skipped or neutral", () => {
  const run = (name, status, conclusion) => ({ name, status, conclusion });
  assert.equal(verdict([]).state, "pending", "no runs yet is not green");
  assert.equal(verdict([run("check", "in_progress", null), run("release", "completed", "skipped")]).state, "pending");
  assert.equal(verdict([run("check", "completed", "success"), run("release", "completed", "skipped"), run("x", "completed", "neutral")]).state, "passed");
  assert.deepEqual(verdict([run("check", "completed", "failure"), run("site", "completed", "cancelled"), run("r", "completed", "skipped")]), {
    state: "failed", failed: ["check: failure", "site: cancelled"],
  });
  const pagesOff = [run("check", "completed", "success"), run("build", "completed", "failure")];
  assert.equal(verdict(pagesOff, ["build"]).state, "passed", "a check known red for another reason can be ignored by name");
  assert.equal(verdict([run("build", "completed", "failure")], ["build"]).state, "pending", "ignoring every run is not green");
});
