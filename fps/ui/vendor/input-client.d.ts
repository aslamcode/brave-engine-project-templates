/** The two families of control. Rebinding a key moves it for the keyboard and the mouse together; a pad is its own. */
export type InputFamily = 'keyboardMouse' | 'gamepad';
/** Which family of pad a button is drawn for. */
export type GamepadStyle = 'xbox' | 'playStation' | 'nintendo' | 'generic';
/** What a control is called, and enough to draw it: for a pad button, which one (`south`, `leftShoulder`...) and for what family of pad, so that a page picks the icon. */
export interface IInputLabel {
    text: string;
    device: InputFamily;
    button?: string;
    style?: GamepadStyle;
}
/** One place of an action. */
export interface IInputSlotView {
    /** Empty when nothing is bound there. */
    label?: IInputLabel;
    /** For a compass or a pair: each part (`up`, `down`, `left`, `right`, or `negative`, `positive`), `null` for one that is not bound. */
    parts?: Record<string, IInputLabel | null>;
    /** The player moved it from what the project says. */
    changed: boolean;
    /** What it is bound to, as the engine stores it: `{ kind: 'key', code: 'KeyE' }`, `{ kind: 'mouseButton', button: 0 }`, a compass with its parts... For `matches()`. */
    binding?: IInputBindingView;
}
/** A binding as the engine stores it, by shape: only what a page needs to recognise a key or a button. */
export interface IInputBindingView {
    kind: string;
    code?: string;
    button?: number | string;
    [part: string]: unknown;
}
export interface IInputActionView {
    name: string;
    /** What a menu calls it. */
    label: string;
    type: 'button' | 'axis' | 'vector2';
    delta: boolean;
    /** One of the engine's own actions (move, look, jump...): it can be rebound, not removed. */
    builtIn: boolean;
    slots: Record<InputFamily, IInputSlotView[]>;
}
export interface IInputSnapshot {
    version: number;
    /** The family the player used last: what a prompt shows. */
    device: InputFamily;
    style: GamepadStyle;
    /** A rebinding is waiting for a key. */
    rebinding: boolean;
    actions: IInputActionView[];
}
/** Where to put a new control: the n-th place of a family of an action, or one part of a compass in it. */
export interface IRebindRequest {
    action: string;
    family: InputFamily;
    slot: number;
    /** `up`, `down`, `left`, `right` of a compass, `negative`, `positive` of a pair. */
    part?: string;
    /** What to do when the control is already on something else. Default `swap`: the other place gets what this one had. */
    policy?: 'swap' | 'unbind' | 'refuse' | 'allow';
    /** Controls that end the wait without binding (default Esc). */
    cancel?: {
        kind: 'key';
        code: string;
    }[];
    /**
     * Whether a mouse button can be what is bound (default true). A page asks for `false`: its empty space forwards a click to the game as a mouse press, so "click away to give up" would bind the left
     * button. The keys and the wheel still bind.
     */
    mouse?: boolean;
}
export interface IRebindResult {
    /** `bound`, `cancelled` (Esc, or another request), or `refused` (the control was on something else and the policy said no). */
    status: 'bound' | 'cancelled' | 'refused';
    /** What was pressed. */
    binding?: unknown;
    change?: {
        applied: boolean;
        conflicts: {
            action: string;
            family: InputFamily;
            slot: number;
            part?: string;
        }[];
        problem?: string;
    };
}
declare class InputActions {
    /** Tells every time anything the page draws changes (the controls, the device in use, a rebinding waiting): draw again. */
    readonly onChange: {
        on: (listener: () => void) => {
            off(): void;
        };
    };
    /** A listener that does not connect the page: the `data-input-action` watcher is there in every page that loads the package, and only the elements that ask connect it. */
    hear(listener: () => void): {
        off(): void;
    };
    private readonly host;
    private readonly listeners;
    private current?;
    private connection?;
    /** Resolves when the host has answered for the first time: wait for it before the first draw so that no prompt is drawn empty. */
    get ready(): Promise<void>;
    /** The family the player used last: what a prompt shows. The keyboard until the host has answered. */
    get device(): InputFamily;
    /** The family of pad the pad's labels are for. */
    get style(): GamepadStyle;
    /** A rebinding is waiting for the player to press something. */
    get isRebinding(): boolean;
    /** Every action, with what it is bound to: a rebinding menu's rows. Empty until the host has answered. */
    get all(): readonly IInputActionView[];
    /** One action with its places, or nothing if the project has none by that name. */
    viewOf(action: string): IInputActionView | undefined;
    /**
     * What an action is bound to, in words. By default in the family the player is using (a pad's button after they touched a pad, the key after they touched the keyboard), the other family when the first has
     * nothing; `device` and `slot` ask for one. Nothing when the action is bound to nothing, and until the host has answered.
     */
    labelOf(action: string, options?: {
        device?: InputFamily;
        slot?: number;
    }): IInputLabel | undefined;
    /** Every place of a family as words, in order, `undefined` for one that is empty: the cells of a rebinding row. */
    labelsOf(action: string, family: InputFamily): (IInputLabel | undefined)[];
    /**
     * Whether a key or mouse button event the PAGE heard is one of the keyboard-and-mouse controls of the action (a key of a compass counts). The game does not hear the keys of a page that has the focus (a
     * pause menu), so a page that wants "the journal key closes the journal" asks here with its own `keydown`. A pad's controls are not events of a page.
     */
    matches(action: string, event: {
        code?: string;
        button?: number;
    }): boolean;
    /** Waits for the player to press a control and binds it. Resolves with what became of it. The page's own keys are not what is read: the game takes the keyboard back for the wait. */
    rebind(request: IRebindRequest): Promise<IRebindResult>;
    /** Ends a rebinding that is waiting, as cancelled. */
    cancelRebind(): void;
    /** Back to the project's controls: one action (and one family of it), or everything. */
    resetBindings(action?: string, family?: InputFamily): void;
    private connect;
    private take;
}
/**
 * The controls, for a page of the UI. `Input.actions.labelOf('interact')` is what the key of that action is called now, in the family the player is using; a prompt that says "Press E" says what is bound instead.
 *
 * ```ts
 * import { Input } from '@brave/ui-bridge';
 * hint.textContent = `Press ${Input.actions.labelOf('interact')?.text ?? '?'} to open`;
 * Input.actions.onChange.on(() => render());                    // the player rebound it, or picked up a pad
 * const result = await Input.actions.rebind({ action: 'interact', family: 'keyboardMouse', slot: 0 });
 * ```
 *
 * For plain HTML no code is needed: `<kbd data-input-action="interact"></kbd>` (see `input-dom.ts`). The page connects to the controls only when it uses them.
 */
export declare class Input {
    static readonly actions: InputActions;
}
export {};
