// Assembles mobile/www: the website files, vendored third-party libraries (so the app works offline,
// no CDN), and the native overlay. The website itself is NOT modified; index.html is rewritten in www only.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), mobile = resolve(here, '..'), repo = resolve(mobile, '..'), out = join(mobile, 'www');
const nm = (...p) => join(mobile, 'node_modules', ...p);

export function buildIndex(html) {
  const swap = (re, repl, what) => { if (!re.test(html)) throw new Error('index.html: expected script not found: ' + what); html = html.replace(re, repl); };
  swap(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@[^"]+"[^>]*>\s*<\/script>/, '<script src="./vendor/tesseract.min.js" defer></script><script src="./native-bridge.js" defer></script><script src="./vendor/ocr-local.js" defer></script>', 'tesseract');
  swap(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"[^>]*>\s*<\/script>/, '<script src="./vendor/supabase.min.js" defer></script>', 'supabase');
  if (/https:\/\/cdn\.jsdelivr\.net/.test(html)) throw new Error('index.html still references the CDN');
  return html;
}

export function shellFiles(swSource) { // the same file list the PWA service worker caches
  const m = swSource.match(/const SHELL=\[([^\]]+)\]/); if (!m) throw new Error('SHELL list not found in sw.js');
  return [...m[1].matchAll(/'\.\/([^']+)'/g)].map(x => x[1]).filter(f => f && f !== 'index.html');
}

export function build() {
  rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'vendor', 'tesseract', 'core'), { recursive: true }); mkdirSync(join(out, 'vendor', 'tesseract', 'lang'), { recursive: true });
  for (const f of shellFiles(readFileSync(join(repo, 'sw.js'), 'utf8'))) { const src = join(repo, f); if (!existsSync(src)) throw new Error('missing web file ' + f); cpSync(src, join(out, f)); }
  writeFileSync(join(out, 'index.html'), buildIndex(readFileSync(join(repo, 'index.html'), 'utf8')));
  cpSync(join(here, '..', 'web-overlay', 'native-bridge.js'), join(out, 'native-bridge.js'));
  cpSync(join(here, '..', 'web-overlay', 'ocr-local.js'), join(out, 'vendor', 'ocr-local.js'));
  cpSync(nm('@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), join(out, 'vendor', 'supabase.min.js'));
  cpSync(nm('tesseract.js', 'dist', 'tesseract.min.js'), join(out, 'vendor', 'tesseract.min.js'));
  cpSync(nm('tesseract.js', 'dist', 'worker.min.js'), join(out, 'vendor', 'tesseract', 'worker.min.js'));
  for (const core of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) cpSync(nm('tesseract.js-core', core), join(out, 'vendor', 'tesseract', 'core', core));
  for (const lang of ['eng', 'fra']) cpSync(nm('@tesseract.js-data', lang, '4.0.0_best_int', lang + '.traineddata.gz'), join(out, 'vendor', 'tesseract', 'lang', lang + '.traineddata.gz'));
  const size = d => readdirSync(d).reduce((a, f) => { const p = join(d, f); return a + (statSync(p).isDirectory() ? size(p) : statSync(p).size); }, 0);
  console.log('www ready: ' + (size(out) / 1048576).toFixed(1) + ' MB');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
