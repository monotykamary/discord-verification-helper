import assert from 'node:assert/strict';
import test from 'node:test';
import { bindPopup, MESSAGES } from '../extension/popup.js';
import { ADAPTERS } from '../extension/adapters.js';
import { runInDiscord } from '../extension/discord.js';
import { fixture } from './fixture.js';

function popup(options = {}) {
  const elements = new Map(['inspect', 'open', 'status', 'details', 'bundle', 'requirement'].map(id => [id, {
    disabled: id === 'open', hidden: true, textContent: '', dataset: {}, listeners: {},
    addEventListener(event, listener) { this.listeners[event] = listener; },
    async click() { if (!this.disabled) return this.listeners.click(); },
  }]));
  const doc = { getElementById: id => elements.get(id) };
  const calls = [];
  const f = fixture(options.fixture);
  let tab = { id: 7, url: 'https://discord.com/channels/@me' };
  const api = {
    tabs: { async query(query) { assert.deepEqual(query, { active: true, currentWindow: true }); return [tab]; } },
    scripting: { async executeScript(call) {
      calls.push(call);
      assert.deepEqual(call.target, { tabId: 7, frameIds: [0] });
      assert.equal(call.world, 'MAIN');
      assert.equal(call.func, runInDiscord);
      assert.equal(call.args[1], ADAPTERS);
      if (options.reject) throw new Error('A private error that must not be displayed');
      return [{ frameId: 0, result: options.reply ?? await f.run(call.args[0]) }];
    } },
  };
  bindPopup(api, doc);
  return { element: id => elements.get(id), calls, api, f, changeTab: value => { tab = value; } };
}

test('popup is idle until clicked; inspect then open uses only the reviewed main-frame function', async () => {
  const p = popup();
  assert.equal(p.calls.length, 0);
  assert.equal(p.element('open').disabled, true);
  await p.element('inspect').click();
  assert.equal(p.element('status').textContent, MESSAGES.ready);
  assert.equal(p.element('open').disabled, false);
  await p.element('open').click();
  assert.equal(p.element('status').textContent, MESSAGES.opened);
  assert.equal(p.element('open').disabled, true);
  assert.deepEqual(p.calls.map(call => call.args[0]), ['inspect', 'open']);
  assert.equal(p.f.stats.mounts, 1);
});

test('does not execute on a lookalike domain', async () => {
  const p = popup();
  p.changeTab({ id: 7, url: 'https://discord.com.evil.invalid/channels/@me' });
  await p.element('inspect').click();
  assert.equal(p.element('status').textContent, MESSAGES.wrong_page);
  assert.equal(p.calls.length, 0);
});

test('requires a new inspection if the active tab changes', async () => {
  const p = popup();
  await p.element('inspect').click();
  p.changeTab({ id: 8, url: 'https://discord.com/channels/@me' });
  await p.element('open').click();
  assert.equal(p.element('status').textContent, MESSAGES.tab_changed);
  assert.equal(p.calls.length, 1);
  assert.equal(p.element('open').disabled, true);
});

test('handles navigation away and missing active-tab access without injection', async () => {
  for (const tab of [undefined, { id: 7 }, { id: 7, url: 'chrome://extensions/' }]) {
    const p = popup();
    p.changeTab(tab);
    await p.element('inspect').click();
    assert.equal(p.element('status').textContent, MESSAGES.wrong_page);
    assert.equal(p.calls.length, 0);
  }
});

test('unknown builds disable opening and show a bounded safe bundle identifier', async () => {
  const p = popup({ fixture: { bundle: '/assets/web.123abc.js' } });
  await p.element('inspect').click();
  assert.equal(p.element('status').textContent, MESSAGES.unsupported_build);
  assert.equal(p.element('bundle').textContent, '/assets/web.123abc.js');
  assert.equal(p.element('open').disabled, true);
});

test('untrusted result strings cannot inject HTML or expose arbitrary page values', async () => {
  const p = popup({ reply: { status: '<img src=x>', bundle: '<script>private</script>', requiredAction: 'private' } });
  await p.element('inspect').click();
  assert.equal(p.element('status').textContent, MESSAGES.execution_failed);
  assert.equal(p.element('bundle').textContent, '');
  assert.equal(p.element('requirement').textContent, 'Not available');
  assert.equal(p.element('open').disabled, true);
});

test('Chrome errors are sanitized and never replay an effect', async () => {
  const p = popup({ reject: true });
  await p.element('inspect').click();
  assert.equal(p.element('status').textContent, MESSAGES.execution_failed);
  assert.equal(p.calls.length, 1);
  assert.equal(p.element('inspect').disabled, false);
  assert.equal(p.element('open').disabled, true);
});

test('serializes clicks while Chrome is responding', async () => {
  const p = popup();
  let release;
  const originalQuery = p.api.tabs.query;
  p.api.tabs.query = async args => { await new Promise(resolve => { release = resolve; }); return originalQuery(args); };
  const pending = p.element('inspect').click();
  await p.element('inspect').listeners.click();
  assert.equal(p.calls.length, 0);
  release();
  await pending;
  assert.equal(p.calls.length, 1);
});
