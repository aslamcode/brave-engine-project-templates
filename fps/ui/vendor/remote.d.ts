import { ReservedLifecycleKey } from './bridge-protocol';
interface RemoteableSignal<D> {
    on(listener: (data: D) => void, target?: any): {
        off(): void;
    };
    emit(data?: D): void;
}
export type RemoteSignal<D> = {
    on(cb: (data: D) => void, options?: {
        sampleEvery?: number;
    }): {
        off(): void;
    };
};
export type Remote<T> = {
    [K in keyof Omit<T, ReservedLifecycleKey>]: T[K] extends RemoteableSignal<infer D> ? RemoteSignal<D> : T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : (value?: T[K]) => Promise<T[K]>;
};
/**
 * Returns a fully typed remote stub for the Service registered under `channel` on the host side (the
 * editor's own overlay, or a runtime UI host built the same way) — every method call and Signal
 * subscription round-trips through a single `MessagePort` connection shared by every `remote()` call on
 * the page (see the module-level transport below for how that connection is established).
 *
 * ```ts
 * import type { InventoryService } from '.../inventory.service'; // types only, erased at compile time
 * const inventory = remote<InventoryService>('InventoryService');
 * const items = await inventory.getItems();
 * inventory.onItemAdded.on(item => renderPickup(item), { sampleEvery: 250 });
 * ```
 */
export declare function remote<T>(channel: string): Remote<T>;
/**
 * The click-through fix — the host's iframe element stays `pointer-events: auto` unconditionally (a
 * dynamic none/auto toggle driven from in here is broken by construction: pointer-events:none makes
 * the iframe invisible to EVERY pointer event, including the one that would be needed to detect
 * leaving "none" again — nothing inside could ever undo it). Instead, this forwards any mouse/wheel
 * event that lands on genuinely empty UI space (not a real interactive element) to the host, which
 * reconstructs it as a real event and dispatches it on the scene canvas — so camera orbit, gizmo
 * drag, etc. still work everywhere the UI itself has nothing to say about. Call once, anywhere early
 * in the UI app's own bootstrap.
 *
 * Requires the UI project's own global stylesheet to start from "nothing is clickable" and opt real
 * interactive elements back in:
 * ```css
 * * { pointer-events: none; }
 * a, button, input, select, textarea, [role="button"] { pointer-events: auto; }
 * ```
 *
 * `elementFromPoint()` finds the topmost element that's still a valid hit-test target — but that is
 * NOT the same thing as "the topmost element with pointer-events != none," which is what this actually
 * needs to know. Confirmed live (traced with temporary logging while chasing a click-forwarding bug):
 * over genuinely empty space it returns `<html>`, not `null` — pointer-events:none only ever makes an
 * element defer to whatever's *underneath* it, and there is nothing underneath the document root, so
 * the root stays a valid target regardless of its own computed pointer-events. So the check below
 * can't be "did elementFromPoint find anything" (an earlier, buggier version of this function used
 * exactly that and as a result never forwarded a single event, ever — every point on the page "found"
 * at least `<html>`) — it has to ask whether what it found actually opted into pointer-events itself.
 */
export declare function enablePointerBridging(): void;
export {};
