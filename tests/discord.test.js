import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './fixture.js';

function clean(f) {
  assert.equal(f.stats.sensitiveReads, 0);
  assert.equal(f.stats.initialized, 0);
  assert.equal(f.chunks.length, 0);
  assert.equal(Reflect.ownKeys(f.installed).length, 0);
  assert.equal(Reflect.ownKeys(f.runtime.m).length, 0);
  assert.equal(f.stats.observers, 0);
  assert.equal(f.stats.timers.size, 0);
}

test('inspect reports only the required action and bundle, without persistent runtime changes', async () => {
  const f = fixture();
  const result = await f.run();
  assert.equal(result.status, 'ready');
  assert.equal(result.requiredAction, 'REQUIRE_REVERIFIED_EMAIL');
  assert.deepEqual(Object.keys(result).sort(), ['bundle', 'requiredAction', 'status']);
  assert.equal(f.stats.mounts, 0);
  await f.run();
  assert.equal(f.stats.probes, 2);
  clean(f);
});

for (const [label, options, expected] of [
  ['foreign origin', { origin: 'https://discord.com.attacker.invalid' }, 'wrong_page'],
  ['plain HTTP', { origin: 'http://discord.com' }, 'wrong_page'],
  ['child frame', { frame: true }, 'wrong_page'],
  ['login page', { pathname: '/login' }, 'not_in_app'],
  ['no loaded bundle', { scripts: [] }, 'not_ready'],
  ['unknown build', { bundle: '/assets/web.abcdef.js' }, 'unsupported_build'],
  ['foreign bundle', { scripts: [{ src: 'https://attacker.invalid/assets/web.d4c7976eccf337f1.js' }] }, 'not_ready'],
  ['duplicate bundles', { scripts: Array(2).fill({ src: 'https://discord.com/assets/web.d4c7976eccf337f1.js' }) }, 'unsupported_build'],
  ['signed out', { signedOut: true }, 'not_signed_in'],
  ['no required action', { action: null }, 'no_action'],
  ['different action', { action: 'REQUIRE_CAPTCHA' }, 'unsupported_action'],
  ['untrusted action', { action: '<script>secret</script>' }, 'unsupported_action'],
  ['missing store', { missingModule: 'requiredAction' }, 'incompatible_client'],
  ['missing component', { missingModule: 'verification' }, 'incompatible_client'],
  ['changed layer key', { key: 'new-key' }, 'incompatible_client'],
]) {
  test(`fails closed: ${label}`, async () => {
    const f = fixture(options);
    const result = await f.run('open');
    assert.equal(result.status, expected);
    assert.equal(f.stats.mounts, 0);
    assert.equal(result.requiredAction, undefined);
    clean(f);
  });
}

test('invalid mode is rejected before touching the runtime', async () => {
  const f = fixture();
  assert.equal((await f.run('submit')).status, 'invalid_request');
  assert.equal(f.stats.probes, 0);
  clean(f);
});

test('pre-runtime native push is undone by exact probe identity', async () => {
  const f = fixture({ nativePush: true });
  assert.equal((await f.run()).status, 'runtime_unavailable');
  clean(f);
});

test('runtime failures are sanitized', async () => {
  const f = fixture();
  f.chunks.push = () => { throw new Error('Do not expose sensitive exception text'); };
  const result = await f.run();
  assert.equal(result.status, 'runtime_unavailable');
  assert(!JSON.stringify(result).includes('sensitive'));
  clean(f);
});

for (const asyncRender of [false, true]) {
  test(`opens the real component, confirms its control, and never submits (async=${asyncRender})`, async () => {
    const f = fixture({ asyncRender });
    assert.equal((await f.run('open')).status, 'opened');
    assert.equal(f.stats.mounts, 1);
    assert.equal(f.layers[0].key, 'verification');
    assert.deepEqual(f.stats.deadlines, [2000]);
    assert.equal((await f.run('open')).status, 'already_registered');
    assert.equal(f.stats.mounts, 1);
    assert.equal(f.actionStore.getAction(), 'REQUIRE_REVERIFIED_EMAIL');
    clean(f);
  });
}

test('does not duplicate an existing native verification layer', async () => {
  const original = { key: 'verification', render() {} };
  const f = fixture({ layers: [original] });
  assert.equal((await f.run('open')).status, 'already_registered');
  assert.equal(f.layers[0], original);
  assert.equal(f.stats.mounts, 0);
  clean(f);
});

test('re-checks the actual requirement before mounting', async () => {
  const f = fixture({ actions: ['REQUIRE_REVERIFIED_EMAIL', null] });
  assert.equal((await f.run('open')).status, 'action_changed');
  assert.equal(f.stats.mounts, 0);
  clean(f);
});

for (const options of [{ render: false }, { hidden: true }, { visibilityThrows: true }]) {
  test(`unconfirmed UI rolls back only its own layer: ${JSON.stringify(options)}`, async () => {
    const original = { key: 'other', render() {} };
    const f = fixture({ ...options, layers: [original] });
    assert.equal((await f.run('open')).status, 'ui_not_confirmed');
    assert.deepEqual(f.layers, [original]);
    assert.equal(f.stats.removals, 1);
    clean(f);
  });
}

test('mount exceptions remove the owned layer and expose no exception data', async () => {
  const f = fixture({ mountThrows: true });
  const result = await f.run('open');
  assert.equal(result.status, 'open_failed');
  assert.equal(f.layers.length, 0);
  clean(f);
});

test('rollback does not remove a replacement native layer', async () => {
  const f = fixture({ render: false });
  const originalMount = f.layerApi.B8;
  const replacement = { key: 'verification', render() {} };
  f.layerApi.B8 = (...args) => { const key = originalMount(...args); f.layers.splice(0, 1, replacement); return key; };
  assert.equal((await f.run('open')).status, 'ui_not_confirmed');
  assert.equal(f.layers[0], replacement);
  assert.equal(f.stats.removals, 0);
  clean(f);
});
