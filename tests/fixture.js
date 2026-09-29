import vm from 'node:vm';
import { ADAPTERS } from '../extension/adapters.js';
import { runInDiscord } from '../extension/discord.js';

export function fixture(options = {}) {
  const adapter = ADAPTERS[0];
  const layers = options.layers ?? [];
  const stats = { probes: 0, initialized: 0, mounts: 0, removals: 0, observers: 0, timers: new Set(), deadlines: [], sensitiveReads: 0 };
  const observers = new Set();
  let visible = false;
  let reads = 0;
  const installed = Object.create(null);
  const chunks = [];
  const runtime = () => { stats.initialized++; throw new Error('Must not initialize modules'); };
  runtime.c = Object.create(null);
  runtime.m = Object.create(null);
  const forbidden = () => { stats.sensitiveReads++; throw new Error('Sensitive access forbidden'); };
  const user = new Proxy({}, { get: forbidden, ownKeys: forbidden });
  const Component = function NativeVerification() {};
  const Layer = function NativeLayer() {};
  const actionStore = { getAction() {
    const index = reads++;
    return options.actions ? options.actions[Math.min(index, options.actions.length - 1)] : Object.hasOwn(options, 'action') ? options.action : 'REQUIRE_REVERIFIED_EMAIL';
  } };
  const layerApi = {
    xr: { getState: () => ({ fullScreenLayers: layers }) },
    B8(render, layerOptions) {
      stats.mounts++;
      layers.push({ key: layerOptions.layerKey, render });
      if (options.mountThrows) throw new Error('Native mount failed');
      const wrapper = render();
      if (wrapper.type !== 'div' || wrapper.props.children.type !== Component || wrapper.props.style.display !== 'contents') throw new Error('Wrong native component');
      const show = () => { visible = options.render !== false; for (const observer of observers) observer.callback(); };
      if (options.asyncRender) queueMicrotask(show); else show();
      return layerOptions.layerKey;
    },
    dF(key) { stats.removals++; for (let i = layers.length - 1; i >= 0; i--) if (layers[i].key === key) layers.splice(i, 1); visible = false; },
  };
  const exports = {
    requiredAction: { A: actionStore },
    currentUser: { default: { getCurrentUser: () => options.signedOut ? null : user } },
    verification: { A: Component },
    layers: layerApi,
    jsx: { jsx: (type, props) => ({ type, props }) },
    layerComponent: { Ay: Layer },
    keys: { _s: options.key ?? 'verification' },
  };
  for (const [name, id] of Object.entries(adapter.modules)) runtime.c[id] = { exports: exports[name] };
  Object.defineProperty(runtime.c, '999999', { get: forbidden });
  if (options.missingModule) delete runtime.c[adapter.modules[options.missingModule]];
  chunks.push = function (entry) {
    stats.probes++;
    const [ids, factories, initialize] = entry;
    let returned;
    if (ids.some(id => installed[id] !== 0)) {
      Object.assign(runtime.m, factories);
      if (initialize) returned = initialize(runtime);
    }
    Array.prototype.push.call(chunks, entry);
    for (const id of ids) installed[id] = 0;
    return returned;
  };
  if (options.nativePush) chunks.push = Array.prototype.push;
  const button = {
    getClientRects: () => visible ? [{}] : [],
    checkVisibility: () => visible && !options.hidden,
  };
  const document = {
    scripts: options.scripts ?? [{ src: `https://discord.com${options.bundle ?? adapter.bundle}` }],
    documentElement: {},
    querySelector(selector) {
      if (options.visibilityThrows) throw new Error('Document unavailable');
      return selector === '[data-discord-verification-helper="native-email-reverification"] button' && visible ? button : null;
    },
  };
  Object.defineProperty(document, 'cookie', { get: forbidden });
  const window = { webpackChunkdiscord_app: chunks };
  window.top = options.frame ? {} : window;
  Object.defineProperty(window, 'localStorage', { get: forbidden });
  const context = {
    window, document, URL, Symbol,
    location: { origin: options.origin ?? 'https://discord.com', pathname: options.pathname ?? '/channels/@me' },
    getComputedStyle: () => ({ display: 'block', visibility: options.hidden ? 'hidden' : 'visible', opacity: '1' }),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { observers.add(this); stats.observers++; }
      disconnect() { if (observers.delete(this)) stats.observers--; }
    },
    setTimeout(callback, ms) {
      stats.deadlines.push(ms);
      const id = setTimeout(() => { stats.timers.delete(id); callback(); }, Math.min(ms, 15));
      stats.timers.add(id);
      return id;
    },
    clearTimeout(id) { stats.timers.delete(id); clearTimeout(id); },
    fetch: forbidden,
    XMLHttpRequest: forbidden,
  };
  return {
    stats, layers, chunks, installed, runtime, actionStore, layerApi, context,
    async run(mode = 'inspect') {
      return JSON.parse(JSON.stringify(await vm.runInNewContext(`(${runInDiscord.toString()})(mode, adapters)`, { ...context, mode, adapters: ADAPTERS })));
    },
  };
}
