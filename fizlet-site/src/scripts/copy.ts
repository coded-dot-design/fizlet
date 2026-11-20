// The Copy keys (CodeBlock, and the kept-as-built code cards): copy the card's code, say so, reset.
for (const key of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  const label = key.lastChild as Text;
  key.addEventListener("click", async () => {
    const text = key.closest(".code-card")?.querySelector("code")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      label.nodeValue = "Copied";
    } catch {
      label.nodeValue = "Select it";
    }
    setTimeout(() => (label.nodeValue = "Copy"), 1400);
  });
}
