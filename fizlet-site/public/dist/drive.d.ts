/** What drive needs from the ground: height and normal under (x, z); the return is a surface kind. */
export interface DriveGround {
    sample(x: number, z: number, out: {
        [i: number]: number;
    }): number;
}
/** Something that takes events: an engine's ring (`engine.events`). */
export interface DriveEvents {
    emit(type: string, a?: number, b?: number, x?: number, y?: number, v?: number): unknown;
}
/** Options for `drive()`: the vehicle's shape, its feel and its limits. Defaults by `kind`. */
export interface DriveOptions {
    /** "car" (four wheels, default) or "bike" (two in line, leans into turns, rear-wheel drive). */
    kind?: "car" | "bike";
    /** Wheel offsets from the body's centre, [forward, right, …] (car: ±0.75 × ±0.5; bike: ±0.6 × 0). */
    wheels?: ArrayLike<number>;
    /** Wheel radius (car 0.28, bike 0.32). */
    radius?: number;
    /** Spring length at full stretch, from the body's origin to the wheel centre (car 0.3, bike 0.35). */
    rest?: number;
    /** Spring travel before the bump stop (car 0.24, bike 0.3; a long-travel buggy or trophy truck 0.5 or more). */
    travel?: number;
    /** Bounce frequency of the springs, Hz (default 2.2). */
    hz?: number;
    /** The spring rate instead of `hz`: the whole vehicle's, per unit mass, 1/s² (the sag is gravity / stiffness;
     *  default (2π · 2.2)² ≈ 191). */
    stiffness?: number;
    /** Progressive springs: the rate grows by this share times (compression / travel)² (default 0: linear; 1 is
     *  twice as stiff at full travel, soft over small bumps and firm on a big landing). */
    progressive?: number;
    /** Damping ratio of the springs while they compress (default 0.75). */
    damping?: number;
    /** Damping ratio while they extend (default `damping`): more holds the body down after a landing instead of a bounce. */
    rebound?: number;
    /** The bump stop past `travel`: its rate as a multiple of the spring's (default 10). */
    bump?: number;
    /** Body inertia for pitch and roll, a multiple of the springs' match (same bounce as heave): one number, or
     *  [pitch, roll] (default 1; more pitches and rolls slower and further). */
    inertia?: number | ArrayLike<number>;
    /** How fast a wheel off the ground drops to full droop, units / s (default Infinity: at once; drawing only). */
    droop?: number;
    /** Gravity, units / s² (default 20). */
    gravity?: number;
    /** Acceleration at full throttle from a standstill (car 10, bike 12). */
    accel?: number;
    /** Top speed on the flat (car 16, bike 18): throttle's pull fades to 0 there. */
    top?: number;
    /** Braking deceleration (default 22). */
    brake?: number;
    /** Top speed backwards (brake held at a stop; default 5). */
    reverse?: number;
    /** Rolling drag with no pedal, units / s² (default 2.5). */
    coast?: number;
    /** Sideways grip, in g (car 1, bike 1.15): the most sideways acceleration the tyres hold. */
    grip?: number;
    /** Rear grip left at the full handbrake / drift input (default 0.4). */
    drift?: number;
    /** How far the tail swings out on the handbrake: the turn tightens by 1 + swing (default 1). */
    swing?: number;
    /** Most slide angle (body to travel) a drift holds before the swing stops, radians (default 0.8). */
    slide?: number;
    /** Share of the sideways speed the tyres hand back as forward speed coming out of a drift (default 0.35). */
    recover?: number;
    /** For `touch`: mass (car 1, bike 0.5). */
    mass?: number;
    /** For `touch`: the hull, [half length, half width] (a box; default the wheels plus their radius), or one radius (a circle). */
    hull?: number | ArrayLike<number>;
    /** Most steering, as a wheel angle (car 0.6, bike 0.7). */
    steer?: number;
    /** Speed at which steering is down to half (default 12). */
    steerFall?: number;
    /** Centre of mass height over the springs: squat, dive and body roll (car 0.35, bike 0.3). */
    cg?: number;
    /** Bike: most lean into a turn (default 0.9). */
    lean?: number;
    /** Pitch control in the air, rad / s² at full throttle (nose up) or brake (nose down) (car 2, bike 6). */
    airPitch?: number;
    /** A landing (or a moment on the ground) this far off the slope's pitch crashes (car 1, bike 0.65). */
    crashPitch?: number;
    /** Off the slope's roll by this much crashes: a rollover (car 1.1; bikes do not check). */
    crashRoll?: number;
    /** Landing faster than this downward crashes (default 30). */
    crashDrop?: number;
    /** Grip multiplier per ground kind: surfaces[k] for kind k (default 1). */
    surfaces?: ArrayLike<number>;
    /** Steps per `step()` (default 2: the springs stay stable at 60 Hz). */
    substeps?: number;
    /** An event ring: `drive:air`, `drive:land` (v: how far off the slope), `drive:crash`, `drive:drift`
     *  (v: the chain's score; b: 1 when broken), with `id` as a. */
    events?: DriveEvents;
    /** The id events carry (default 0). */
    id?: number;
}
/** What `drive` returns. */
export type Drive = Ride;
/** A vehicle: its state in typed arrays, its read-outs as getters, its model in module functions that
 *  take it (one call target for every vehicle: per-vehicle closures made a loop over several cars
 *  deoptimise on "wrong call target" and box doubles, 10 to 15 young GCs per 200,000 rounds of 4 cars). */
declare class Ride {
    /** Everything the model carries from one step to the next (and its read-outs), as bytes over one
     *  buffer: copy it out and back in to roll back and replay bit for bit (`save` / `load`). */
    state: Uint8Array;
    /** @internal The model's state (see `S` below), first in `state`'s buffer. */
    _s: Float64Array;
    /** @internal Flags: crashed, air, rest. */
    _f: Uint8Array;
    /** @internal The options, resolved (see `P` below). */
    _p: Float64Array<ArrayBuffer>;
    /** @internal Scratch: slope (pitch, roll), substep; trig; spring sums; one ground sample. */
    _sl: Float64Array<ArrayBuffer>;
    _tr: Float64Array<ArrayBuffer>;
    _ac: Float64Array<ArrayBuffer>;
    _g4: Float64Array<ArrayBuffer>;
    /** @internal The ground, the event ring, wheel count, bike (1) or not (0), driven wheels, kinds' grip. */
    _g: DriveGround;
    _ev: DriveEvents | undefined;
    _n: number;
    _bike: number;
    _drv: Uint8Array;
    _surf: ArrayLike<number>;
    /** @internal Per wheel: ground height, raw compression, spin rate. */
    _gh: Float64Array;
    _raw: Float64Array;
    _sr: Float64Array;
    /** World velocity. */
    vel: Float64Array;
    /** Inputs, each step: [throttle 0..1, brake 0..1 (reverse at a stop), steer −1..1 (+1 right), drift (handbrake) 0..1]. */
    input: Float64Array;
    /** The body's origin (at the spring tops), world. */
    pos: Float64Array;
    /** Body rotation in diorama's order, [roll about x, yaw about y, pitch about z (nose up +)]. */
    rot: Float64Array;
    /** Wheel offsets [forward, right, …] as given. */
    wheels: Float64Array;
    /** Per wheel: spring compression, 0..travel (the wheel centre sits rest − comp under the body origin). */
    comp: Float64Array;
    /** Per wheel: compression as a share of the travel, 0..1 (draw the arm's angle from it). */
    press: Float64Array;
    /** Per wheel: rolling angle, radians. */
    spin: Float64Array;
    /** Per wheel: 1 on the ground. */
    contact: Uint8Array;
    /** Per wheel: centre in world [x, y, z, …] (dust emitters, skid marks). */
    wheel: Float64Array;
    /** Wheel radius, spring rest length and travel. */
    radius: number;
    rest: number;
    travel: number;
    /** The last landing: [downward speed, how far off the slope it was (radians)]. */
    landing: Float64Array;
    /** For `touch`: mass. */
    mass: number;
    /** For `touch`: [half length, half width] (a box), or [radius, 0] (a circle). */
    hull: Float64Array<ArrayBuffer>;
    constructor(ground: DriveGround, o: DriveOptions);
    /** Copy the whole state into `dst` (at least `state.length` bytes); allocates nothing. */
    save(dst: Uint8Array): void;
    /** Put back a state `save` copied (from this vehicle or one made with the same options); allocates nothing. */
    load(src: Uint8Array): void;
    /** Set the inputs (the same as writing `input`). */
    set(throttle: number, brake: number, steer: number, drift?: number): void;
    /** Advance dt seconds (the engine's fixed step) in `substeps`; returns true while anything moves. */
    step(dt: number): boolean;
    /** Put it down at (x, z) facing `yaw`, on the ground at the springs' sag, still and not crashed; also after a crash. */
    reset(x: number, z: number, yaw?: number): void;
    /** Spin it round at `rate` rad/s (+ left) for `secs` with no control (the handbrake's grip, the spin dying
     *  away): a rammed drifter. Breaks the drift chain. */
    spinOut(rate: number, secs?: number): void;
    /** Heading, radians (forward is (cos yaw, 0, −sin yaw), diorama's rot y). */
    get yaw(): number;
    /** Speed along the heading (negative backwards). */
    get speed(): number;
    /** Ground speed, any direction. */
    get groundSpeed(): number;
    /** Sideways slide speed: drifting when it is over a unit or so. */
    get slip(): number;
    /** 0..1: how hard the tyres throw dust or spray (scale an emitter by it). */
    get dust(): number;
    /** The front wheels' steering angle (draw them turned). */
    get steerAngle(): number;
    /** Seconds in the air (0 on the ground). */
    get air(): number;
    /** 0..1: how hard it is drifting now (the slide angle past a small slip, scaled by speed; 0 in the air,
     *  crashed or spun out): score it per second. */
    get drift(): number;
    /** The body's angle to its travel, radians (+: the nose points left of where it is going). */
    get slide(): number;
    /** The current drift chain's score so far (∫ drift dt; banked by `drive:drift` half a second after it ends). */
    get chain(): number;
    /** The last chain banked (or broken). */
    get lastChain(): number;
    /** Seconds of a spin-out left (no control while it lasts). */
    get spinning(): number;
    /** The most any spring is pushed in now, as a share of the travel (1 and over: on the bump stop). */
    get stroke(): number;
    /** The body's pitch against the ground under its wheels, radians (nose up +): squat, dive, a landing's nod. */
    get bodyPitch(): number;
    /** The body's roll against the ground under its wheels, radians (diorama's sign: −rot[0]; a bike's lean). */
    get bodyRoll(): number;
    /** Crashed (inputs ignored until `reset`). */
    get crashed(): boolean;
    /** At rest: nothing moves (the engine may settle). */
    get resting(): boolean;
}
/** A vehicle on `ground`: set `input` (or `set`), `step(dt)` from the engine's step, draw from `pos`, `rot`, `comp`. */
export declare function drive(ground: DriveGround, o?: DriveOptions): Drive;
/** `touch`'s last contact: [impulse, normal x, normal z (from a to b), depth, contact x, contact z]. */
export declare const touchHit: Float64Array<ArrayBuffer>;
/** Options for `touch` and `touchAll`. */
export interface TouchOptions {
    /** Bounce along the normal, 0 (dead) .. 1 (elastic) (default 0.3). */
    bounce?: number;
    /** Two bodies further apart than this in height pass (one in the air over the other; default 1). */
    height?: number;
    /** Called on each contact, after the push: `hit` is `touchHit`. */
    onHit?: (a: Drive, b: Drive, hit: Float64Array) => void;
}
/** Push vehicles `a` and `b` apart if their hulls overlap (box against box, box against circle, circle
 *  against circle, on the ground plane) by their masses, and bounce their velocities along the contact
 *  normal. Deterministic (no builtin trig: the headings' cosines come from the model). True on a contact. */
export declare function touch(a: Drive, b: Drive, o?: TouchOptions): boolean;
/** `touch` every pair of `list`, in order (i < j: the same order on every machine); returns the contacts. */
export declare function touchAll(list: ArrayLike<Drive>, o?: TouchOptions): number;
/** Options for `chase`: where the camera sits behind its target and how fast it follows. */
export interface ChaseOptions {
    /** Distance from the target (default 9). */
    dist?: number;
    /** Look-down angle (default 0.45). */
    pitch?: number;
    /** Aim this far over the target (default 0.6). */
    lift?: number;
    /** Aim ahead by this many seconds of the target's velocity (default 0.25; needs `vel`). */
    ahead?: number;
    /** Turn from straight behind (radians; default 0). */
    side?: number;
    /** Follow rate, 1/s (default 4): higher is tighter. */
    rate?: number;
    /** Turn rate, 1/s (default 2.5). */
    turn?: number;
    /** Jump straight there (reduced motion, a respawn). */
    snap?: boolean;
}
/** Ease diorama camera `cam` behind and above `target` (`pos` [x, y, z], `yaw`, optional `vel`) over
 *  dt seconds; returns true while it still moves (settle-friendly). */
export declare function chase(cam: {
    yaw: number;
    pitch: number;
    dist: number;
    tx: number;
    ty: number;
    tz: number;
}, target: {
    pos: ArrayLike<number>;
    yaw: number;
    vel?: ArrayLike<number>;
}, o?: ChaseOptions, dt?: number): boolean;
export {};
