var BraveUiBridge = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // libs/core/src/module/bridge/remote-entry.ts
  var remote_entry_exports = {};
  __export(remote_entry_exports, {
    RESERVED_LIFECYCLE_KEYS: () => RESERVED_LIFECYCLE_KEYS,
    enablePointerBridging: () => enablePointerBridging,
    remote: () => remote
  });

  // libs/core/src/module/bridge/bridge-protocol.ts
  var RESERVED_LIFECYCLE_KEYS = [
    "active",
    "onLoad",
    "onEnable",
    "onDisable",
    "onAwake",
    "onStart",
    "onUpdate",
    "onRenderUpdate",
    "onFixedUpdate",
    "onDrawSceneMask",
    "onDrawGizmos",
    "onDestroy",
    "onHotReload",
    "onAfterClone",
    "onSave",
    "onRestore"
  ];

  // libs/core/src/module/bridge/remote.ts
  function remote(channel) {
    return new Proxy({}, {
      get(_target, property) {
        const invoke = (...args) => call(channel, property, args);
        invoke.on = (cb, options) => subscribe(channel, property, cb, options?.sampleEvery);
        return invoke;
      }
    });
  }
  function enablePointerBridging() {
    let forwarding = false;
    const forward = (event) => {
      if (event.type === "mousedown" || event.type === "mousemove" && !event.buttons) forwarding = false;
      if (!forwarding || event.type === "wheel") {
        const el = document.elementFromPoint(event.clientX, event.clientY);
        if (el && getComputedStyle(el).pointerEvents !== "none") {
          return;
        }
      }
      if (event.type === "mousedown") forwarding = true;
      const wheel = event;
      postMessageToHost({
        kind: "forwardInput",
        type: event.type,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        buttons: event.buttons,
        movementX: event.movementX ?? 0,
        movementY: event.movementY ?? 0,
        deltaX: wheel.deltaX ?? 0,
        deltaY: wheel.deltaY ?? 0,
        deltaMode: wheel.deltaMode ?? 0,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      });
      if (event.type === "mouseup") forwarding = false;
    };
    ["mousedown", "mousemove", "mouseup", "wheel"].forEach((type) => {
      document.addEventListener(type, forward, { passive: true });
    });
    const forwardKey = (event) => {
      if (event.key !== "Escape") return;
      postMessageToHost({
        kind: "forwardKey",
        type: event.type,
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      });
    };
    ["keydown", "keyup"].forEach((type) => {
      document.addEventListener(type, forwardKey, { passive: true });
    });
  }
  var nextId = 1;
  var port;
  var pendingCalls = /* @__PURE__ */ new Map();
  var signalListeners = /* @__PURE__ */ new Map();
  var queued = [];
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    if (!event.ports.length) return;
    port = event.ports[0];
    port.onmessage = onPortMessage;
    port.postMessage({ kind: "hello" });
    queued.splice(0).forEach((message) => port.postMessage(message));
  });
  function onPortMessage(event) {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.kind === "result") {
      const pending = pendingCalls.get(message.id);
      if (!pending) return;
      pendingCalls.delete(message.id);
      if (message.ok === true) {
        pending.resolve(message.value);
      } else {
        pending.reject(new Error(message.error));
      }
      return;
    }
    if (message.kind === "signal") {
      signalListeners.get(message.subId)?.(message.data);
    }
  }
  function call(channel, method, args) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pendingCalls.set(id, { resolve, reject });
      try {
        postMessageToHost({ kind: "call", id, channel, method, args });
      } catch (err) {
        pendingCalls.delete(id);
        reject(err);
      }
    });
  }
  function subscribe(channel, property, cb, sampleEvery) {
    const subId = nextId++;
    signalListeners.set(subId, cb);
    postMessageToHost({ kind: "subscribe", subId, channel, property, sampleEvery });
    return {
      off: () => {
        signalListeners.delete(subId);
        postMessageToHost({ kind: "unsubscribe", subId });
      }
    };
  }
  function postMessageToHost(message) {
    structuredClone(message);
    if (!port) {
      queued.push(message);
      return;
    }
    port.postMessage(message);
  }
  return __toCommonJS(remote_entry_exports);
})();
