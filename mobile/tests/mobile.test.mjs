import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildIndex, shellFiles, build } from '../scripts/build-web.mjs';
const here = dirname(fileURLToPath(import.meta.url)), mobile = resolve(here, '..'), repo = resolve(mobile, '..');
const require = createRequire(import.meta.url);
const { parseAuthUrl } = require('../web-overlay/native-bridge.js');

test('buildIndex swaps both CDN scripts for bundled files and leaves no CDN reference', () => {
  const out = buildIndex(readFileSync(join(repo, 'index.html'), 'utf8'));
  assert.doesNotMatch(out, /cdn\.jsdelivr\.net/);
  assert.match(out, /\.\/vendor\/tesseract\.min\.js/);
  assert.match(out, /\.\/vendor\/supabase\.min\.js/);
  assert.match(out, /native-bridge\.js/);
});
test('buildIndex fails loudly if a CDN script cannot be rewritten', () => {
  assert.throws(() => buildIndex('<html></html>'), /expected script not found/);
});
test('shellFiles parses the service-worker list and excludes index.html', () => {
  const files = shellFiles(readFileSync(join(repo, 'sw.js'), 'utf8'));
  assert.ok(files.includes('app.js') && files.includes('cloud-sync.js'));
  assert.ok(!files.includes('index.html'));
});
test('built www contains every local asset index.html references, and the OCR data', () => {
  build();
  const html = readFileSync(join(mobile, 'www', 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(\.\/[^"#?]+)"/g)) assert.ok(existsSync(join(mobile, 'www', m[1])), 'missing ' + m[1]);
  for (const f of ['vendor/tesseract/worker.min.js', 'vendor/tesseract/lang/eng.traineddata.gz', 'vendor/tesseract/lang/fra.traineddata.gz', 'vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js'])
    assert.ok(existsSync(join(mobile, 'www', f)), f);
});
test('parseAuthUrl handles implicit-flow tokens, PKCE codes, errors and foreign URLs', () => {
  assert.deepEqual(parseAuthUrl('top.kcaron.cardstudio://auth#access_token=a&refresh_token=r&type=magiclink'), { accessToken: 'a', refreshToken: 'r' });
  assert.deepEqual(parseAuthUrl('top.kcaron.cardstudio://auth?code=abc'), { code: 'abc' });
  assert.equal(parseAuthUrl('https://evil.example/auth#access_token=a&refresh_token=r'), null);
  assert.ok(parseAuthUrl('top.kcaron.cardstudio://auth#error=access_denied&error_description=x').error);
});
test('manifest declares camera, deep link, no backup; signing reads env only', () => {
  const m = readFileSync(join(mobile, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(m, /android\.permission\.CAMERA/);
  assert.match(m, /android:scheme="top\.kcaron\.cardstudio" android:host="auth"/);
  assert.match(m, /allowBackup="false"/);
  const g = readFileSync(join(mobile, 'android/app/build.gradle'), 'utf8');
  assert.match(g, /System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);
  assert.doesNotMatch(g, /storePassword\s+["'][^"']/);
});
