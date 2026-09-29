/**
 * Runs in the page's MAIN world through chrome.scripting.executeScript.
 * Keep this function self-contained: Chrome serializes it without its imports.
 * Never return page objects, identity fields, exceptions, or runtime references.
 */
export async function runInDiscord(mode, adapters) {
  const result = (status, extra = {}) => ({ status, ...extra });
  if (mode !== 'inspect' && mode !== 'open') return result('invalid_request');
  if (window.top !== window || location.origin !== 'https://discord.com') {
    return result('wrong_page');
  }
  if (!location.pathname.startsWith('/channels/')) return result('not_in_app');

  let adapter;
  let bundle;
  try {
    const entries = Array.from(document.scripts, script => {
      try {
        const url = new URL(script.src);
        return url.origin === location.origin && /^\/assets\/web\.[a-f0-9]+\.js$/.test(url.pathname)
          ? url.pathname : null;
      } catch {
        return null;
      }
    }).filter(Boolean);
    if (entries.length === 0) return result('not_ready');
    if (entries.length !== 1) return result('unsupported_build');
    bundle = entries[0];
    adapter = adapters.find(entry => entry.bundle === bundle);
    if (!adapter) return result('unsupported_build', { bundle });
  } catch {
    return result('unsupported_build');
  }

  let runtime;
  try {
    const chunks = window.webpackChunkdiscord_app;
    if (!Array.isArray(chunks) || typeof chunks.push !== 'function') {
      return result('not_ready', { bundle });
    }
    const before = chunks.length;
    const stop = {};
    const probe = [[Symbol('verification-helper-inspection')], {}, candidate => {
      runtime = candidate;
      throw stop;
    }];
    // On the pinned Rspack build this callback runs BEFORE array insertion or
    // installed-chunk bookkeeping. Throwing our sentinel aborts registration.
    // An empty ID list would skip the callback; a unique Symbol triggers it.
    try {
      chunks.push(probe);
    } catch (error) {
      if (error !== stop) throw error;
    }
    if (chunks.length !== before) {
      // A native Array.push means the expected runtime is not installed yet.
      // Remove only the just-added, empty probe, never unrelated chunks.
      const last = chunks[chunks.length - 1];
      if (chunks.length === before + 1 && last === probe) {
        chunks.pop();
      }
      return result('runtime_unavailable', { bundle });
    }
    if (typeof runtime !== 'function' || !runtime.c) {
      return result('runtime_unavailable', { bundle });
    }
  } catch {
    return result('runtime_unavailable', { bundle });
  }

  let store;
  let layers;
  let jsx;
  let Component;
  let Layer;
  let key;
  try {
    const cached = name => runtime.c[adapter.modules[name]]?.exports;
    // Do not call runtime(id): only use modules Discord has already initialized.
    store = cached('requiredAction')?.A;
    const users = cached('currentUser')?.default;
    if (typeof store?.getAction !== 'function' || typeof users?.getCurrentUser !== 'function') {
      return result('incompatible_client', { bundle });
    }
    if (users.getCurrentUser() == null) return result('not_signed_in', { bundle });
    const action = store.getAction();
    if (action == null) return result('no_action', { bundle });
    if (action !== adapter.action) return result('unsupported_action', { bundle });
    layers = cached('layers');
    jsx = cached('jsx')?.jsx;
    Component = cached('verification')?.A;
    Layer = cached('layerComponent')?.Ay;
    key = cached('keys')?._s;
    if (typeof layers?.B8 !== 'function' || typeof layers?.dF !== 'function' ||
        typeof layers?.xr?.getState !== 'function' || typeof jsx !== 'function' ||
        typeof Component !== 'function' || typeof Layer !== 'function' || key !== 'verification') {
      return result('incompatible_client', { bundle });
    }
    const current = layers.xr.getState().fullScreenLayers;
    if (!Array.isArray(current)) return result('incompatible_client', { bundle });
    if (current.some(item => item.key === key)) {
      return result('already_registered', { bundle, requiredAction: action });
    }
    if (mode === 'inspect') return result('ready', { bundle, requiredAction: action });
  } catch {
    return result('incompatible_client', { bundle });
  }

  const marker = 'native-email-reverification';
  const render = () => jsx('div', {
    'data-discord-verification-helper': marker,
    style: { display: 'contents' },
    children: jsx(Component, {}),
  });
  const rollback = () => {
    try {
      const matching = layers.xr.getState().fullScreenLayers.filter(item => item.key === key);
      if (matching.length === 1 && matching[0].render === render) layers.dF(key);
    } catch {
      // Never reset the whole layer store or remove somebody else's UI.
    }
  };

  try {
    // Re-check immediately before the only UI mutation. Never set this flag.
    if (store.getAction() !== adapter.action) return result('action_changed', { bundle });
    if (layers.xr.getState().fullScreenLayers.some(item => item.key === key)) {
      return result('already_registered', { bundle, requiredAction: adapter.action });
    }
    layers.B8(render, { layerKey: key, Layer, disableAnimation: true });
    const visible = () => {
      try {
        const button = document.querySelector(`[data-discord-verification-helper="${marker}"] button`);
        if (!button || !button.getClientRects().length) return false;
        if (typeof button.checkVisibility === 'function') {
          return button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        }
        const style = getComputedStyle(button);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      } catch {
        return false;
      }
    };
    // Bound all observation and clean it up. This does not click or submit.
    const shown = await new Promise(resolve => {
      let timer;
      let observer;
      const finish = value => { clearTimeout(timer); observer?.disconnect(); resolve(value); };
      observer = new MutationObserver(() => { if (visible()) finish(true); });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      timer = setTimeout(() => finish(visible()), 2000);
      if (visible()) finish(true);
    });
    if (!shown) {
      rollback();
      return result('ui_not_confirmed', { bundle });
    }
    return result('opened', { bundle, requiredAction: adapter.action });
  } catch {
    rollback();
    return result('open_failed', { bundle });
  }
}
