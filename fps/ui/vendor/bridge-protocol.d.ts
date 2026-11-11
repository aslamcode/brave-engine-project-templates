export interface BridgeConnectMessage {
    kind: 'connect';
}
export type BridgeMessage = {
    kind: 'call';
    id: number;
    channel: string;
    method: string;
    args: any[];
} | {
    kind: 'result';
    id: number;
    ok: true;
    value: any;
} | {
    kind: 'result';
    id: number;
    ok: false;
    error: string;
} | {
    kind: 'subscribe';
    subId: number;
    channel: string;
    property: string;
    sampleEvery?: number;
} | {
    kind: 'unsubscribe';
    subId: number;
} | {
    kind: 'signal';
    subId: number;
    data: any;
} | {
    kind: 'hello';
} | {
    kind: 'forwardInput';
    type: string;
    clientX: number;
    clientY: number;
    button: number;
    buttons: number;
    movementX: number;
    movementY: number;
    deltaX: number;
    deltaY: number;
    deltaMode: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
} | {
    kind: 'forwardKey';
    type: 'keydown' | 'keyup';
    key: string;
    code: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
};
export declare const RESERVED_LIFECYCLE_KEYS: readonly ["active", "onLoad", "onEnable", "onDisable", "onAwake", "onStart", "onUpdate", "onRenderUpdate", "onFixedUpdate", "onDrawSceneMask", "onDrawGizmos", "onDestroy", "onHotReload", "onAfterClone", "onSave", "onRestore"];
export type ReservedLifecycleKey = typeof RESERVED_LIFECYCLE_KEYS[number];
