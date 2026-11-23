#!/usr/bin/env node
/* Builds dist/ for Cloudflare Pages: the same files Vercel serves (everything except mobile/, see .vercelignore),
 * plus:
 *  - _headers:     the security headers of vercel.json for every file, except the Content-Security-Policy
 *                  (too long for a _headers line; functions/_middleware.js adds the full set on pages);
 *  - _routes.json: where Functions run (the pages, the service worker and /api/*); everything else is static.
 * Cloudflare Pages settings: build command "node tools/build-pages.mjs", output directory "dist".
 * Run locally: node tools/build-pages.mjs && npx wrangler pages dev dist
 */
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
// Not served: the Android project (as on Vercel), server code (api/ runs as a Function, its source is not a page), host code and config, build output, caches, git and CI.
export const SKIP = new Set(['mobile', 'api', 'functions', 'dist', 'node_modules', '.git', '.github', '.vercel', '.wrangler',
  'wrangler.toml', '.vercelignore', '.gitignore', '.gitattributes']);
const SKIP_PATHS = ['tools/.cache'];
export const FUNCTION_ROUTES = ['/', '/index.html', '/privacy', '/privacy.html', '/sw.js', '/api/*'];

export function headerRules(vercel) {
  const all = vercel.headers.find(h => h.source === '/(.*)').headers;
  const lines = ['/*', ...all.filter(h => h.key !== 'Content-Security-Policy').map(h => `  ${h.key}: ${h.value}`)];
  for (const l of lines) if (l.length > 2000) throw new Error('A _headers line is over 2,000 characters: ' + l.slice(0, 60));
  return lines.join('\n') + '\n';
}

function copyTree(from, to, rel = '') {
  for (const name of readdirSync(from)) {
    const r = rel ? rel + '/' + name : name;
    if ((!rel && SKIP.has(name)) || SKIP_PATHS.includes(r) || name.startsWith('.DS_Store')) continue;
    const src = path.join(from, name), dst = path.join(to, name);
    if (statSync(src).isDirectory()) { mkdirSync(dst, {recursive: true}); copyTree(src, dst, r); }
    else cpSync(src, dst);
  }
}

export function build() {
  if (existsSync(OUT)) rmSync(OUT, {recursive: true, force: true});
  mkdirSync(OUT, {recursive: true});
  copyTree(ROOT, OUT);
  const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  writeFileSync(path.join(OUT, '_headers'), headerRules(vercel));
  writeFileSync(path.join(OUT, '_routes.json'), JSON.stringify({version: 1, include: FUNCTION_ROUTES, exclude: []}, null, 2) + '\n');
  return OUT;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build();
  console.log('Built dist/ for Cloudflare Pages:', readdirSync(OUT).length, 'top-level entries');
}
