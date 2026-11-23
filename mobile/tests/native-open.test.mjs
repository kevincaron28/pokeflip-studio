import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
test('openExternal uses the Capacitor Browser plugin (Chrome Custom Tab) for https only', async () => {
  const calls = [];
  globalThis.window = globalThis;
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { Browser: { open: async o => calls.push(o.url) } } };
  delete require.cache[require.resolve('../web-overlay/native-bridge.js')];
  const N = require('../web-overlay/native-bridge.js');
  assert.equal(N.isNative, true);
  assert.equal(await N.openExternal('https://shop.example/cart/1:2'), true);
  assert.deepEqual(calls, ['https://shop.example/cart/1:2']);
  assert.equal(await N.openExternal('http://insecure.example'), false);
  assert.equal(await N.openExternal('javascript:alert(1)'), false);
  assert.equal(calls.length, 1);
  delete globalThis.Capacitor;
  delete globalThis.window;
});
test('Browser plugin is a dependency and registered for the Android project', async () => {
  const fs = await import('node:fs');
  assert.match(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'), /"@capacitor\/browser"/);
  assert.match(fs.readFileSync(new URL('../android/app/capacitor.build.gradle', import.meta.url), 'utf8'), /capacitor-browser/);
});
