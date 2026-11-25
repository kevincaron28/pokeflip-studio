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

test('buildIndex swaps the CDN script for the bundled file, loads the native bridge first, no OCR', () => {
  const out = buildIndex(readFileSync(join(repo, 'index.html'), 'utf8'));
  assert.doesNotMatch(out, /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(out, /tesseract|ocr-local/i, 'the camera scanner and its OCR are gone');
  assert.match(out, /\.\/vendor\/supabase\.min\.js/);
  assert.match(out, /<\/main><script src="\.\/fcm-config\.js" defer><\/script><script src="\.\/native-bridge\.js" defer><\/script>/);
});
test('buildIndex fails loudly if a CDN script cannot be rewritten', () => {
  assert.throws(() => buildIndex('<html></html>'), /expected script not found/);
});
test('shellFiles parses the service-worker list and excludes index.html', () => {
  const files = shellFiles(readFileSync(join(repo, 'sw.js'), 'utf8'));
  assert.ok(files.includes('app.js') && files.includes('cloud-sync.js'));
  assert.ok(!files.includes('index.html'));
});
test('built www contains every local asset index.html references, and no OCR data', () => {
  build();
  const html = readFileSync(join(mobile, 'www', 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(\.\/[^"#?]+)"/g)) assert.ok(existsSync(join(mobile, 'www', m[1])), 'missing ' + m[1]);
  assert.ok(!existsSync(join(mobile, 'www', 'vendor', 'tesseract')), 'no OCR files in the app');
});
test('parseAuthUrl handles implicit-flow tokens, PKCE codes, errors and foreign URLs', () => {
  assert.deepEqual(parseAuthUrl('top.kcaron.cardstudio://auth#access_token=a&refresh_token=r&type=magiclink'), { accessToken: 'a', refreshToken: 'r' });
  assert.deepEqual(parseAuthUrl('top.kcaron.cardstudio://auth?code=abc'), { code: 'abc' });
  assert.equal(parseAuthUrl('https://evil.example/auth#access_token=a&refresh_token=r'), null);
  assert.ok(parseAuthUrl('top.kcaron.cardstudio://auth#error=access_denied&error_description=x').error);
});
test('manifest: no camera permission (the scanner is gone), deep link, no backup; signing reads env only', () => {
  const m = readFileSync(join(mobile, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.doesNotMatch(m, /android\.permission\.CAMERA|android\.hardware\.camera/);
  assert.match(m, /android:scheme="top\.kcaron\.cardstudio" android:host="auth"/);
  assert.match(m, /allowBackup="false"/);
  const g = readFileSync(join(mobile, 'android/app/build.gradle'), 'utf8');
  assert.match(g, /System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);
  assert.doesNotMatch(g, /storePassword\s+["'][^"']/);
});
