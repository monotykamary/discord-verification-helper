import { ADAPTERS } from './adapters.js';
import { runInDiscord } from './discord.js';

export const MESSAGES = Object.freeze({
  ready: 'Discord requires email re-verification. You can open its native verification screen below.',
  opened: 'The native re-verification button is visible in Discord. Close this popup and complete verification there.',
  already_registered: 'Discord already has a verification layer registered. No duplicate was added. If it is still invisible, reload Discord or contact Support.',
  no_action: 'Discord is not currently reporting a required verification action. Nothing was changed. This does not prove that every account restriction is cleared.',
  unsupported_action: 'Discord requests a different verification action. This release supports only email re-verification; it will not guess or alter the requirement.',
  unsupported_build: 'This Discord client build has not been reviewed. Nothing was opened. Check for an updated helper or contact Discord Support.',
  not_ready: 'Discord has not finished loading its app. Wait for it to load, then check again.',
  not_in_app: 'Open your signed-in Discord app at discord.com/channels/@me first.',
  not_signed_in: 'No signed-in user is available. Sign into Discord yourself, then check again.',
  wrong_page: 'Use this helper on a https://discord.com web-app tab only.',
  runtime_unavailable: 'The expected client runtime is unavailable. The helper stopped without opening a screen.',
  incompatible_client: 'The reviewed client interfaces do not match. The helper stopped rather than guessing.',
  action_changed: 'The verification requirement changed. Check it again before opening anything.',
  ui_not_confirmed: 'The native button did not become visible. The helper attempted to remove only its own UI; no verification was submitted.',
  open_failed: 'Discord could not render the native prompt. The helper attempted to remove only its own UI. Contact Support if the problem persists.',
  invalid_request: 'Invalid helper request. Close and reopen the extension popup.',
  tab_changed: 'The active tab changed. Return to Discord and check its requirement again.',
  execution_failed: 'Chrome could not run the helper on this tab. Reopen the popup on Discord; no automatic retry was made.',
});

export function bindPopup(api, doc) {
  const inspect = doc.getElementById('inspect');
  const open = doc.getElementById('open');
  const status = doc.getElementById('status');
  const details = doc.getElementById('details');
  const bundle = doc.getElementById('bundle');
  const requirement = doc.getElementById('requirement');
  let checkedTab;
  let busy = false;

  function show(reply) {
    const code = Object.hasOwn(MESSAGES, reply?.status) ? reply.status : 'execution_failed';
    status.textContent = MESSAGES[code];
    status.dataset.tone = ['ready', 'opened', 'no_action'].includes(code) ? 'success' : 'warning';
    const safeBundle = typeof reply?.bundle === 'string' && /^\/assets\/web\.[a-f0-9]+\.js$/.test(reply.bundle) ? reply.bundle : '';
    bundle.textContent = safeBundle;
    requirement.textContent = reply?.requiredAction === 'REQUIRE_REVERIFIED_EMAIL' ? reply.requiredAction : 'Not available';
    details.hidden = !safeBundle;
    open.disabled = code !== 'ready';
    return code;
  }

  async function execute(mode) {
    if (busy) return;
    busy = true;
    inspect.disabled = true;
    open.disabled = true;
    status.textContent = mode === 'inspect' ? 'Checking the client’s reported requirement…' : 'Opening Discord’s native UI…';
    status.dataset.tone = '';
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      let allowed = false;
      try { allowed = new URL(tab?.url).origin === 'https://discord.com'; } catch { /* No accessible tab URL. */ }
      if (!allowed || !Number.isInteger(tab?.id)) { show({ status: 'wrong_page' }); checkedTab = undefined; return; }
      if (mode === 'open' && tab.id !== checkedTab) { show({ status: 'tab_changed' }); checkedTab = undefined; return; }
      const responses = await api.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: 'MAIN',
        func: runInDiscord,
        args: [mode, ADAPTERS],
      });
      const reply = responses?.length === 1 && responses[0].frameId === 0 ? responses[0].result : null;
      const code = show(reply);
      checkedTab = code === 'ready' ? tab.id : undefined;
    } catch {
      show({ status: 'execution_failed' });
      checkedTab = undefined;
    } finally {
      busy = false;
      inspect.disabled = false;
    }
  }

  inspect.addEventListener('click', () => execute('inspect'));
  open.addEventListener('click', () => execute('open'));
}

if (typeof chrome !== 'undefined' && typeof document !== 'undefined') bindPopup(chrome, document);
