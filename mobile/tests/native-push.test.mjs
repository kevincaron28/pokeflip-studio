import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function load(fcm, PushNotifications) {
  globalThis.window = globalThis;
  globalThis.CARDSTEAD_FCM = fcm;
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { PushNotifications } };
  delete require.cache[require.resolve('../web-overlay/native-bridge.js')];
  return require('../web-overlay/native-bridge.js');
}
function cleanup() { delete globalThis.Capacitor; delete globalThis.CARDSTEAD_FCM; delete globalThis.window; }

function fakePush({ perm = 'granted', token = 'device-token-123', fail = null } = {}) {
  const handlers = {}, calls = [];
  return { calls, handlers,
    addListener: async (name, fn) => { handlers[name] = fn; return { remove() { delete handlers[name]; } }; },
    requestPermissions: async () => { calls.push('perm'); return { receive: perm }; },
    createChannel: async (c) => { calls.push('channel:' + c.id); },
    register: async () => { calls.push('register'); setTimeout(() => fail ? handlers.registrationError?.({ error: fail }) : handlers.registration?.({ value: token }), 0); } };
}

test('app push is off unless the build had a Firebase config', async () => {
  const N = load(false, fakePush());
  assert.equal(N.pushAvailable(), false);
  await assert.rejects(N.registerPush(), /not set up/);
  cleanup();
});

test('with a Firebase config: asks permission, makes the Drop alerts channel, returns the device token', async () => {
  const PN = fakePush();
  const N = load(true, PN);
  assert.equal(N.pushAvailable(), true);
  assert.equal(await N.registerPush(), 'device-token-123');
  assert.deepEqual(PN.calls, ['perm', 'channel:drops', 'register']);
  cleanup();
});

test('permission refused or registration error is reported, not hidden', async () => {
  let N = load(true, fakePush({ perm: 'denied' }));
  await assert.rejects(N.registerPush(), /Allow them in Android settings/);
  N = load(true, fakePush({ fail: 'SERVICE_NOT_AVAILABLE' }));
  await assert.rejects(N.registerPush(), /SERVICE_NOT_AVAILABLE/);
  cleanup();
});

test('build-web writes fcm-config.js from google-services.json and loads it before the bridge; plugin is registered', () => {
  const bw = readFileSync(new URL('../scripts/build-web.mjs', import.meta.url), 'utf8');
  assert.match(bw, /existsSync\(join\(here, '\.\.', 'android', 'app', 'google-services\.json'\)\)/);
  assert.match(bw, /fcm-config\.js" defer><\/script><script src="\.\/native-bridge\.js"/);
  assert.match(readFileSync(new URL('../package.json', import.meta.url), 'utf8'), /"@capacitor\/push-notifications": "8\.1\.3"/);
  assert.match(readFileSync(new URL('../android/app/capacitor.build.gradle', import.meta.url), 'utf8'), /capacitor-push-notifications/);
});
