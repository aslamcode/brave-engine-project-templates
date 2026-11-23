var BraveUiBridge = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // libs/core/src/module/bridge/remote-entry.ts
  var remote_entry_exports = {};
  __export(remote_entry_exports, {
    INPUT_CHANNEL: () => INPUT_CHANNEL,
    Input: () => Input,
    RESERVED_LIFECYCLE_KEYS: () => RESERVED_LIFECYCLE_KEYS,
    SUBTITLES_CHANNEL: () => SUBTITLES_CHANNEL,
    Subtitles: () => Subtitles,
    TRANSLATE_CHANNEL: () => TRANSLATE_CHANNEL,
    Translate: () => Translate,
    enablePointerBridging: () => enablePointerBridging,
    remote: () => remote
  });

  // libs/core/src/module/bridge/bridge-protocol.ts
  var TRANSLATE_CHANNEL = "Translate";
  var SUBTITLES_CHANNEL = "Subtitles";
  var INPUT_CHANNEL = "Input";
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

  // libs/core/src/util/translate/language-file.ts
  function primaryLanguage(code) {
    return code.split("-")[0];
  }
  function languageChain(code, base) {
    const chain = [];
    [code, primaryLanguage(code), base, base ? primaryLanguage(base) : void 0].forEach((candidate) => {
      if (candidate && !chain.includes(candidate)) chain.push(candidate);
    });
    return chain;
  }

  // libs/core/src/util/translate/translate-interpolation.ts
  var ENTRY = /^\{\{[ \t]*([^\s{}]+)[ \t]*\}\}/;
  var BACKSLASH = 92;
  function scanTranslation(source) {
    const pieces = [];
    let literal = "";
    let from = 0;
    while (from < source.length) {
      const open = source.indexOf("{{", from);
      if (open < 0) break;
      const match = ENTRY.exec(source.substring(open));
      if (!match) {
        literal += source.substring(from, open + 1);
        from = open + 1;
        continue;
      }
      if (source.charCodeAt(open - 1) === BACKSLASH) {
        literal += source.substring(from, open - 1) + match[0];
      } else {
        literal += source.substring(from, open);
        if (literal) pieces.push({ text: literal });
        literal = "";
        pieces.push({ text: match[1], entry: match[0] });
      }
      from = open + match[0].length;
    }
    literal += source.substring(from);
    if (literal) pieces.push({ text: literal });
    return pieces;
  }
  function interpolateTranslation(source, read) {
    if (!source.includes("{{")) return source;
    return scanTranslation(source).map((piece) => piece.entry === void 0 ? piece.text : read(piece.text) ?? piece.entry).join("");
  }
  var PARAM = /(?<!\{)\{([A-Za-z_][\w.-]*)\}(?!\})/g;
  function applyTranslationParams(text, params) {
    if (!params || !text.includes("{")) return text;
    return text.replace(PARAM, (written, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : written);
  }

  // libs/core/src/util/translate/translate-path.ts
  function parseTranslationPath(path) {
    if (typeof path !== "string" || path.length === 0) return void 0;
    const steps = [];
    let index = 0;
    while (index < path.length) {
      if (path[index] === "[") {
        const close = path.indexOf("]", index);
        if (close < 0) return void 0;
        const digits = path.slice(index + 1, close);
        if (!/^\d+$/.test(digits)) return void 0;
        steps.push(Number(digits));
        index = close + 1;
      } else {
        let end = index;
        while (end < path.length && path[end] !== "." && path[end] !== "[" && path[end] !== "]") end++;
        if (end === index) return void 0;
        steps.push(path.slice(index, end));
        index = end;
      }
      if (index === path.length) break;
      if (path[index] === "[") continue;
      if (path[index] !== "." || index + 1 === path.length) return void 0;
      index++;
    }
    return steps;
  }
  function readTranslationPath(table, path) {
    const steps = parseTranslationPath(path);
    if (!steps) return { found: false };
    let current = table;
    for (const step of steps) {
      if (current === null || typeof current !== "object") return { found: false };
      if (typeof step === "number") {
        if (!Array.isArray(current) || step >= current.length) return { found: false };
        current = current[step];
        continue;
      }
      if (Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, step)) return { found: false };
      current = current[step];
    }
    return current === void 0 || current === null ? { found: false } : { found: true, value: current };
  }

  // libs/core/src/util/translate/translate-plural.ts
  var PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];
  var rules = /* @__PURE__ */ new Map();
  function isPluralEntry(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return typeof value["other"] === "string" && keys.every((key) => PLURAL_CATEGORIES.includes(key));
  }
  function pluralCount(params) {
    const count = params?.["count"];
    return typeof count === "number" && Number.isFinite(count) ? count : void 0;
  }
  function selectPlural(entry, count, language) {
    if (count === 0 && typeof entry["zero"] === "string") return entry["zero"];
    const form = entry[rulesOf(language).select(count)];
    return typeof form === "string" ? form : entry["other"];
  }
  function rulesOf(language) {
    const key = language || "en";
    let found = rules.get(key);
    if (found) return found;
    try {
      found = new Intl.PluralRules(key);
    } catch {
      found = new Intl.PluralRules("en");
    }
    rules.set(key, found);
    return found;
  }

  // libs/core/src/util/translate/translation-book.ts
  var _TranslationBook = class _TranslationBook {
    constructor(tables, language, base, onMissing) {
      this.tables = tables;
      this.language = language;
      this.base = base;
      this.onMissing = onMissing;
    }
    /** The book a snapshot describes. */
    static fromSnapshot(snapshot, onMissing) {
      return new _TranslationBook(new Map(Object.entries(snapshot.tables)), snapshot.language, snapshot.base, onMissing);
    }
    /** The entry `path` names in the language in use, else in the languages it falls back to. */
    find(path) {
      return this.locate(path).read;
    }
    /** Whether the language in use or the ones it falls back to have the entry. */
    has(path) {
      return this.find(path).found;
    }
    /**
     * The entry: a text with its `{{ entries }}` taken in and its `{name}` filled from `params`; an object, a list or a number as it is. An entry that is a set of plural forms (`one`, `other`...) and is read
     * with a `count` comes back as the text of the form that number takes in the language the entry was found in. An entry nobody has comes back as its own path, and `onMissing` is told.
     */
    get(path, params) {
      const { read, code } = this.locate(path);
      if (!read.found) {
        this.onMissing?.(path);
        return path;
      }
      const count = pluralCount(params);
      const value = count !== void 0 && isPluralEntry(read.value) ? selectPlural(read.value, count, code ?? this.language) : read.value;
      return typeof value === "string" ? this.render(value, params, [path]) : value;
    }
    /** A text with its `{{ entries }}` taken in and its `{name}` filled: what a text field shows. An entry nobody has stays as it is written. */
    resolve(text, params) {
      return this.render(text ?? "", params, []);
    }
    // The entry and the language it was found in, so that what depends on the language (the plural rule) follows the text and not the language in use: an entry that came from the base language is a base language text.
    locate(path) {
      for (const code of languageChain(this.language, this.base)) {
        const table = this.tables.get(code);
        if (!table) continue;
        const read = readTranslationPath(table, path);
        if (read.found) return { read, code };
      }
      return { read: { found: false } };
    }
    // The entries are taken in first and the `{name}`s filled last, in one pass, so that what a parameter holds is never read as an entry or as another parameter.
    render(text, params, stack) {
      return applyTranslationParams(interpolateTranslation(text, (key) => this.entryText(key, stack)), params);
    }
    // What the entry `key` says when it is put in a text: a text (its own entries taken in), a number or a true/false. An object, a list or an entry nobody has is nothing here: the text keeps its `{{ }}`.
    entryText(key, stack) {
      if (stack.includes(key) || stack.length >= _TranslationBook.MAX_DEPTH) return void 0;
      const found = this.find(key);
      if (!found.found) {
        this.onMissing?.(key);
        return void 0;
      }
      const value = found.value;
      if (typeof value === "string") return interpolateTranslation(value, (inner) => this.entryText(inner, [...stack, key]));
      return typeof value === "number" || typeof value === "boolean" ? String(value) : void 0;
    }
  };
  /** How deep an entry may name another before it is left as it is written (a cycle is cut at once). */
  __publicField(_TranslationBook, "MAX_DEPTH", 8);
  var TranslationBook = _TranslationBook;

  // libs/core/src/module/bridge/translate-dom.ts
  var TRANSLATE_ATTRIBUTES = ["placeholder", "title", "alt", "aria-label", "value"];
  var TRANSLATE_PARAMS_ATTRIBUTE = "data-translate-params";
  var TRANSLATE_SELECTOR = ["[data-translate]", ...TRANSLATE_ATTRIBUTES.map((name) => `[data-translate-${name}]`)].join(",");
  var WATCHED_ATTRIBUTES = ["data-translate", TRANSLATE_PARAMS_ATTRIBUTE, ...TRANSLATE_ATTRIBUTES.map((name) => `data-translate-${name}`)];
  function translateParamsOf(element) {
    const written = element.getAttribute(TRANSLATE_PARAMS_ATTRIBUTE);
    if (!written) return void 0;
    try {
      const parsed = JSON.parse(written);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return void 0;
      const params = {};
      Object.entries(parsed).forEach(([name, value]) => {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") params[name] = value;
      });
      return params;
    } catch {
      return void 0;
    }
  }
  function translateElement(element, source) {
    const params = translateParamsOf(element);
    const text = (key) => {
      if (!key || !source.has(key)) return void 0;
      const value = source.get(key, params);
      return typeof value === "string" ? value : void 0;
    };
    const own = text(element.getAttribute("data-translate"));
    if (own !== void 0 && element.textContent !== own) element.textContent = own;
    TRANSLATE_ATTRIBUTES.forEach((name) => {
      const value = text(element.getAttribute(`data-translate-${name}`));
      if (value !== void 0 && element.getAttribute(name) !== value) element.setAttribute(name, value);
    });
  }
  function translateTree(root, source) {
    if ("matches" in root && root.matches(TRANSLATE_SELECTOR)) translateElement(root, source);
    root.querySelectorAll(TRANSLATE_SELECTOR).forEach((element) => translateElement(element, source));
  }
  function watchTranslations(document2, Observer, watched) {
    const all = () => {
      translateTree(document2, watched);
      if (watched.language && document2.documentElement.getAttribute("lang") !== watched.language) document2.documentElement.setAttribute("lang", watched.language);
    };
    watched.onChange.on(all);
    const start = () => {
      if (document2.querySelector(TRANSLATE_SELECTOR)) watched.connect();
      all();
      if (!Observer) return;
      new Observer((records) => {
        let asked = false;
        records.forEach((record) => {
          if (record.type === "attributes") {
            asked = true;
            translateElement(record.target, watched);
            return;
          }
          record.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            const element = node;
            if (element.matches(TRANSLATE_SELECTOR) || element.querySelector(TRANSLATE_SELECTOR)) {
              asked = true;
              translateTree(element, watched);
            }
          });
        });
        if (asked) watched.connect();
      }).observe(document2, { childList: true, subtree: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES });
    };
    if (document2.readyState === "loading") document2.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }

  // libs/core/src/module/bridge/translate-client.ts
  var _Translate = class _Translate {
    /**
     * The entry `path` names (`menu.start`, `dialogs[0].text`) in the language in use: a text with its `{{ other.entry }}` taken in and its `{name}` filled from `params`; an object, a list or a number as it is. An entry
     * nobody has comes back as its own path (and the console says so, once).
     */
    static get(path, params) {
      this.connect();
      return this.book.get(path, params);
    }
    /** Whether the language in use, or one it falls back to, has the entry. */
    static has(path) {
      this.connect();
      return this.book.has(path);
    }
    /** A text with its `{{ entries }}` taken in (and `{name}` filled from `params`). An entry nobody has stays as it is written. */
    static resolve(text, params) {
      this.connect();
      return this.book.resolve(text, params);
    }
    //#region Getters
    /** Resolves when the language has been read for the first time: wait for it before the first render to draw no entry as its path. */
    static get ready() {
      return this.connect();
    }
    /** The language in use (`pt-BR`), or an empty text until the host has answered. */
    static get language() {
      this.connect();
      return this.current?.language ?? "";
    }
    /** The languages the project has: what a menu lists. Empty until the host has answered. */
    static get languages() {
      this.connect();
      return this.current?.languages ?? [];
    }
    //#endregion Getters
    //#region Setters
    /** Asks the game for another language. It is the game that changes it, so `language` reads the new one, and `onChange` tells, when the host answers. */
    static set language(code) {
      this.connect();
      this.host.language(code).catch((error) => console.warn(`[Translate] The language could not be changed: ${error?.message ?? error}`));
    }
    //#endregion Setters
    // Subscribes first and reads second: a change between the two is told again instead of lost. The reading of a snapshot older than the one the page holds is dropped (two answers can cross).
    static connect() {
      if (!this.connection) {
        this.host.onChange.on(() => {
          void this.take();
        }, { sampleEvery: 16 });
        this.connection = this.take();
      }
      return this.connection;
    }
    static async take() {
      const snapshot = await this.host.snapshot();
      if (this.current && snapshot.version < this.current.version) return;
      this.current = snapshot;
      this.book = TranslationBook.fromSnapshot(snapshot, (path) => this.reportMissing(path));
      this.listeners.forEach((listener) => listener());
    }
    static reportMissing(path) {
      const key = `${this.current?.language}\0${path}`;
      if (!this.current?.language || this.missing.has(key)) return;
      this.missing.add(key);
      console.warn(`[Translate] No entry "${path}" in ${this.current.language}.`);
    }
  };
  /** Tells every time the language, or one of the files it is read from, changes: render again. */
  __publicField(_Translate, "onChange", {
    on(listener) {
      _Translate.listeners.add(listener);
      return { off: () => {
        _Translate.listeners.delete(listener);
      } };
    }
  });
  __publicField(_Translate, "host", remote(TRANSLATE_CHANNEL));
  __publicField(_Translate, "listeners", /* @__PURE__ */ new Set());
  __publicField(_Translate, "missing", /* @__PURE__ */ new Set());
  __publicField(_Translate, "book", new TranslationBook(/* @__PURE__ */ new Map(), "", ""));
  __publicField(_Translate, "current");
  __publicField(_Translate, "connection");
  // The page that loads the library gets `data-translate` with no call of its own (a plain `<script>` is all it needs). In a static block, not a method, so that nothing of it is in the class the page's author sees.
  (() => {
    if (typeof document !== "undefined") {
      watchTranslations(document, typeof MutationObserver === "undefined" ? void 0 : MutationObserver, {
        has: (path) => _Translate.has(path),
        get: (path, params) => _Translate.get(path, params),
        // Not `Translate.language`: reading that connects, and a page with no element that asks for the language does not.
        get language() {
          return _Translate.current?.language ?? "";
        },
        connect: () => {
          void _Translate.connect();
        },
        onChange: _Translate.onChange
      });
    }
  })();
  var Translate = _Translate;

  // libs/core/src/module/bridge/subtitles-client.ts
  var NO_LINES = Object.freeze([]);
  var _Subtitles = class _Subtitles {
    //#region Getters
    /** The lines to show now, in the order their clips started. Empty until the host has answered, and while the subtitles are off. */
    static get lines() {
      this.connect();
      return this.current?.lines ?? NO_LINES;
    }
    /** Whether the subtitles are on. `true` until the host has answered. */
    static get enabled() {
      this.connect();
      return this.current?.enabled ?? true;
    }
    /** Resolves when the host has answered for the first time. */
    static get ready() {
      return this.connect();
    }
    //#endregion Getters
    //#region Setters
    /** Asks the game to turn the subtitles on or off. It is the game that changes it, so `enabled` reads the new value, and `onChange` tells, when the host answers. */
    static set enabled(value) {
      this.connect();
      this.host.enabled(!!value).catch((error) => console.warn(`[Subtitles] They could not be turned ${value ? "on" : "off"}: ${error?.message ?? error}`));
    }
    //#endregion Setters
    // Subscribes first and reads second: a change between the two is told again instead of lost. The reading of a snapshot older than the one the page holds is dropped (two answers can cross).
    static connect() {
      if (!this.connection) {
        this.host.onChange.on(() => {
          void this.take();
        }, { sampleEvery: 16 });
        this.connection = this.take();
      }
      return this.connection;
    }
    static async take() {
      const snapshot = await this.host.snapshot();
      if (this.current && snapshot.version < this.current.version) return;
      this.current = snapshot;
      this.listeners.forEach((listener) => listener(snapshot.lines));
    }
  };
  /** Tells every time the lines, or whether they show, change, with the lines to show now. It comes a few milliseconds after the engine's change (the Bridge samples), not in the same frame. Listening is using: it connects. */
  __publicField(_Subtitles, "onChange", {
    on(listener) {
      _Subtitles.listeners.add(listener);
      void _Subtitles.connect();
      return { off: () => {
        _Subtitles.listeners.delete(listener);
      } };
    }
  });
  __publicField(_Subtitles, "host", remote(SUBTITLES_CHANNEL));
  __publicField(_Subtitles, "listeners", /* @__PURE__ */ new Set());
  __publicField(_Subtitles, "current");
  __publicField(_Subtitles, "connection");
  var Subtitles = _Subtitles;

  // libs/core/src/module/bridge/input-dom.ts
  var INPUT_ACTION_ATTRIBUTE = "data-input-action";
  var INPUT_SLOT_ATTRIBUTE = "data-input-slot";
  var INPUT_DEVICE_ATTRIBUTE = "data-input-device";
  var INPUT_SELECTOR = `[${INPUT_ACTION_ATTRIBUTE}]`;
  var WATCHED_ATTRIBUTES2 = [INPUT_ACTION_ATTRIBUTE, INPUT_SLOT_ATTRIBUTE, INPUT_DEVICE_ATTRIBUTE];
  function labelElement(element, source) {
    const action = element.getAttribute(INPUT_ACTION_ATTRIBUTE);
    if (!action) return;
    const slotText = element.getAttribute(INPUT_SLOT_ATTRIBUTE);
    const slot = slotText !== null && /^\d+$/.test(slotText) ? Number(slotText) : void 0;
    const wanted = element.getAttribute(INPUT_DEVICE_ATTRIBUTE);
    const device = wanted === "keyboardMouse" || wanted === "gamepad" ? wanted : void 0;
    const label = source.labelOf(action, { device, slot });
    if (!label) return;
    if (element.textContent !== label.text) element.textContent = label.text;
    setOrRemove(element, "data-input-showing", label.device);
    setOrRemove(element, "data-input-button", label.button);
    setOrRemove(element, "data-input-style", label.style);
  }
  function labelTree(root, source) {
    if ("matches" in root && root.matches(INPUT_SELECTOR)) labelElement(root, source);
    root.querySelectorAll(INPUT_SELECTOR).forEach((element) => labelElement(element, source));
  }
  function watchInputLabels(document2, Observer, watched) {
    const all = () => labelTree(document2, watched);
    watched.onChange.on(all);
    const start = () => {
      if (document2.querySelector(INPUT_SELECTOR)) watched.connect();
      all();
      if (!Observer) return;
      new Observer((records) => {
        let asked = false;
        records.forEach((record) => {
          if (record.type === "attributes") {
            asked = true;
            labelElement(record.target, watched);
            return;
          }
          record.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            const element = node;
            if (element.matches(INPUT_SELECTOR) || element.querySelector(INPUT_SELECTOR)) {
              asked = true;
              labelTree(element, watched);
            }
          });
        });
        if (asked) watched.connect();
      }).observe(document2, { childList: true, subtree: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES2 });
    };
    if (document2.readyState === "loading") document2.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
  function setOrRemove(element, name, value) {
    if (value === void 0) {
      if (element.hasAttribute(name)) element.removeAttribute(name);
    } else if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  // libs/core/src/module/bridge/input-client.ts
  var InputActions = class {
    constructor() {
      /** Tells every time anything the page draws changes (the controls, the device in use, a rebinding waiting): draw again. */
      __publicField(this, "onChange", {
        on: (listener) => {
          this.listeners.add(listener);
          void this.connect();
          return { off: () => {
            this.listeners.delete(listener);
          } };
        }
      });
      __publicField(this, "host", remote(INPUT_CHANNEL));
      __publicField(this, "listeners", /* @__PURE__ */ new Set());
      __publicField(this, "current");
      __publicField(this, "connection");
    }
    /** A listener that does not connect the page: the `data-input-action` watcher is there in every page that loads the package, and only the elements that ask connect it. */
    hear(listener) {
      this.listeners.add(listener);
      return { off: () => {
        this.listeners.delete(listener);
      } };
    }
    //#region Getters
    /** Resolves when the host has answered for the first time: wait for it before the first draw so that no prompt is drawn empty. */
    get ready() {
      return this.connect();
    }
    /** The family the player used last: what a prompt shows. The keyboard until the host has answered. */
    get device() {
      this.connect();
      return this.current?.device ?? "keyboardMouse";
    }
    /** The family of pad the pad's labels are for. */
    get style() {
      this.connect();
      return this.current?.style ?? "generic";
    }
    /** A rebinding is waiting for the player to press something. */
    get isRebinding() {
      this.connect();
      return this.current?.rebinding ?? false;
    }
    /** Every action, with what it is bound to: a rebinding menu's rows. Empty until the host has answered. */
    get all() {
      this.connect();
      return this.current?.actions ?? [];
    }
    //#endregion Getters
    /** One action with its places, or nothing if the project has none by that name. */
    viewOf(action) {
      return this.all.find((candidate) => candidate.name === action);
    }
    /**
     * What an action is bound to, in words. By default in the family the player is using (a pad's button after they touched a pad, the key after they touched the keyboard), the other family when the first has
     * nothing; `device` and `slot` ask for one. Nothing when the action is bound to nothing, and until the host has answered.
     */
    labelOf(action, options = {}) {
      const view = this.viewOf(action);
      if (!view) return void 0;
      const first = options.device ?? this.device;
      const families = options.device ? [options.device] : [first, first === "gamepad" ? "keyboardMouse" : "gamepad"];
      for (const family of families) {
        const slots = view.slots[family] ?? [];
        const slot = options.slot === void 0 ? slots.find((candidate) => !!candidate.label) : slots[options.slot];
        if (slot?.label) return slot.label;
      }
      return void 0;
    }
    /** Every place of a family as words, in order, `undefined` for one that is empty: the cells of a rebinding row. */
    labelsOf(action, family) {
      return (this.viewOf(action)?.slots[family] ?? []).map((slot) => slot.label);
    }
    /**
     * Whether a key or mouse button event the PAGE heard is one of the keyboard-and-mouse controls of the action (a key of a compass counts). The game does not hear the keys of a page that has the focus (a
     * pause menu), so a page that wants "the journal key closes the journal" asks here with its own `keydown`. A pad's controls are not events of a page.
     */
    matches(action, event) {
      return (this.viewOf(action)?.slots.keyboardMouse ?? []).some((slot) => {
        const binding = slot.binding;
        if (!binding) return false;
        return [binding, ...Object.values(binding)].some((candidate) => {
          const leaf = candidate;
          if (!leaf || typeof leaf !== "object") return false;
          return leaf.kind === "key" && event.code !== void 0 && leaf.code === event.code || leaf.kind === "mouseButton" && event.button !== void 0 && leaf.button === event.button;
        });
      });
    }
    /** Waits for the player to press a control and binds it. Resolves with what became of it. The page's own keys are not what is read: the game takes the keyboard back for the wait. */
    rebind(request) {
      this.connect();
      return this.host.rebind(request);
    }
    /** Ends a rebinding that is waiting, as cancelled. */
    cancelRebind() {
      this.connect();
      this.host.cancelRebind().catch(() => void 0);
    }
    /** Back to the project's controls: one action (and one family of it), or everything. */
    resetBindings(action, family) {
      this.connect();
      this.host.resetBindings(action, family).catch(() => void 0);
    }
    // Subscribes first and reads second: a change between the two is told again instead of lost. The reading of a snapshot older than the one the page holds is dropped (two answers can cross).
    connect() {
      if (!this.connection) {
        this.host.onChange.on(() => {
          void this.take();
        }, { sampleEvery: 16 });
        this.connection = this.take();
      }
      return this.connection;
    }
    async take() {
      const snapshot = await this.host.snapshot();
      if (this.current && snapshot.version < this.current.version) return;
      this.current = snapshot;
      this.listeners.forEach((listener) => listener());
    }
  };
  var _Input = class _Input {
  };
  __publicField(_Input, "actions", new InputActions());
  // The page that loads the library gets `data-input-action` with no call of its own (a plain `<script>` is all it needs). In a static block so that nothing of it is in the class the page uses.
  (() => {
    if (typeof document !== "undefined") {
      watchInputLabels(document, typeof MutationObserver === "undefined" ? void 0 : MutationObserver, {
        labelOf: (action, options) => _Input.actions.labelOf(action, options),
        get device() {
          return _Input.actions.device;
        },
        connect: () => {
          void _Input.actions.ready;
        },
        onChange: { on: (listener) => _Input.actions.hear(listener) }
      });
    }
  })();
  var Input = _Input;
  return __toCommonJS(remote_entry_exports);
})();
