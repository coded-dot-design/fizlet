export declare const ICON: {
    sound: string;
    mute: string;
    pause: string;
    play: string;
    fold: string;
    open: string;
    exit: string;
    fire: string;
};
export declare const esc: (t: string) => string;
/** The overlay host, the kit root, the canvas, the toast and the pad: every preset's base. */
export declare const BASE = "\n:host{all:initial!important;position:fixed!important;inset:0!important;display:block!important;z-index:2147483000!important;pointer-events:none!important}\n.bui{position:absolute;inset:0;background:none;font:500 12px/1.4 ui-monospace,monospace}\ncanvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}\n.bui .msg{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));translate:-50% 0;max-width:calc(100% - 24px);pointer-events:none}\n.bui .msg[hidden]{display:none}\n.bui .bui-pad{pointer-events:auto}\n.bui>section{cursor:grab;touch-action:none}.bui>section button{cursor:pointer}.bui>section.drag{cursor:grabbing}\n@media (prefers-reduced-motion:reduce){.bui *{transition:none!important;animation:none!important}}";
/** Every preset's panel drags from anywhere that isn't a key (mouse or touch). CSS min() keeps it on
 *  screen when the window shrinks. */
export declare function drag(card: HTMLElement, signal: AbortSignal): void;
