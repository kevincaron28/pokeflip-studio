#!/usr/bin/env node
/* Local Cloudflare Pages preview: builds dist/ and serves it with the Pages Functions (functions/), exactly as
 * Cloudflare will. Put test eBay keys, if any, in .dev.vars (gitignored); without them /api/ebay-search answers
 * "eBay not connected yet". Run: npm run pages:dev   (then open http://127.0.0.1:8788) */
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './build-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
build();
const port = process.env.PORT || '8788';
const child = spawn('npx', ['--yes', 'wrangler@4.20.0', 'pages', 'dev', 'dist', '--port', port, '--ip', '127.0.0.1'],
  {cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32'});
child.on('exit', code => process.exit(code ?? 0));
