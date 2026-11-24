// Cardstead shop checker on the owner's Windows PC (a home address; Shopify refuses cloud and datacenter addresses).
// Task Scheduler starts it every 2 minutes, hidden, only while the PC is on and the owner is signed in (install-windows.ps1). One pass, same code
// and rules as the server checker (../run.mjs). Settings, including the one secret CHECKER_KEY line, come from a file
// that only the owner's Windows account can read: %LOCALAPPDATA%\Cardstead\checker\checker.env.
// Output goes to %LOCALAPPDATA%\Cardstead\checker\logs\checker.log (kept under 1 MB, one older file kept). The last
// pass is summed up in status.txt; `node run-windows.mjs --status` prints it with its age.
import { readFileSync, writeFileSync, appendFileSync, statSync, renameSync, mkdirSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
export const HOME = process.env.CARDSTEAD_CHECKER_HOME || join(process.env.LOCALAPPDATA || '.', 'Cardstead', 'checker');

/** KEY=VALUE lines; # comments and blank lines ignored; values are not unquoted or expanded. */
export function parseEnv(text) {
  const out = {};
  for (const line of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Appends timestamped lines; past maxBytes the file becomes checker.log.1 (the previous .1 is replaced). */
export function fileLog(file, { maxBytes = 1024 * 1024, now = () => new Date() } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  return (msg) => {
    try { if (statSync(file).size > maxBytes) renameSync(file, file + '.1'); } catch {}
    appendFileSync(file, `${now().toISOString()} ${String(msg).replace(/\r?\n/g, ' ')}\n`);
  };
}

/** Updates the checker code from main at most once an hour (the app folder is a shallow, sparse git copy). */
export function selfUpdate(appDir, log, { git = 'git', maxAgeMs = 3600 * 1000 } = {}) {
  const stamp = join(appDir, '.git', 'FETCH_HEAD');
  try { if (existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < maxAgeMs) return false; } catch {}
  try {
    execFileSync(git, ['-C', appDir, 'fetch', '-q', '--depth', '1', 'origin', 'main'], { stdio: 'ignore', windowsHide: true, timeout: 60000 });
    execFileSync(git, ['-C', appDir, 'reset', '-q', '--hard', 'FETCH_HEAD'], { stdio: 'ignore', windowsHide: true, timeout: 60000 });
    return true;
  } catch (e) { log('code update skipped: ' + (e.message || e).toString().slice(0, 120)); return false; }
}

/** True only for the copy install-windows.ps1 made (%LOCALAPPDATA%\Cardstead\checker\app). */
export function isInstalledCopy(appDir, home = HOME) {
  return resolve(appDir).toLowerCase() === resolve(home, 'app').toLowerCase();
}

/** One pass at a time: a lock file older than 5 minutes is treated as left over from a crash. */
export function lock(file) {
  try { if (Date.now() - statSync(file).mtimeMs > 5 * 60 * 1000) unlinkSync(file); } catch {}
  try { closeSync(openSync(file, 'wx')); return () => { try { unlinkSync(file); } catch {} }; } catch { return null; }
}

/** The one-line status written after every pass (status.txt), in plain words. */
export function statusLine({ at, summary, error }) {
  const t = at.toISOString();
  if (error) return `${t} ERROR ${String(error).replace(/\s+/g, ' ').slice(0, 200)}`;
  const s = summary;
  return `${t} OK ${s.shops} shops due: ${s.read} read, ${s.unchanged} unchanged, ${s.refused} refused (429/403, backing off), ${s.failed} failed, ${s.events} new drops`;
}

/** What --status prints: the last pass and how long ago; a warning when passes have stopped. */
export function describeStatus(text, now = new Date()) {
  const line = String(text || '').trim();
  const at = Date.parse(line.split(' ')[0]);
  if (!line || Number.isNaN(at)) return 'No pass yet. Run one by hand (docs/SHOP-CHECKER-WINDOWS.md, step 2).';
  const mins = Math.round((now.getTime() - at) / 60000);
  const ago = mins < 1 ? 'less than a minute ago' : mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
  const warn = mins > 10 ? '  WARNING: no pass for over 10 minutes (PC was off or signed out, or the task is disabled).' : '';
  return `Last pass ${ago} (${new Date(at).toLocaleString()}): ${line.split(' ').slice(1).join(' ')}${warn}`;
}

async function run() {
  const log = fileLog(join(HOME, 'logs', 'checker.log'));
  const status = (o) => { try { writeFileSync(join(HOME, 'status.txt'), statusLine({ at: new Date(), ...o }) + '\n'); } catch {} };
  const release = lock(join(HOME, 'pass.lock'));
  if (!release) { log('previous pass still running, skipped'); return; }
  try {
    // Only the installed copy updates itself: never reset a developer checkout that happens to run this file.
    const appDir = resolve(here, '..', '..', '..');
    if (isInstalledCopy(appDir) && existsSync(join(appDir, '.git'))) selfUpdate(appDir, log);
    const e = { ...process.env, ...parseEnv(readFileSync(join(HOME, 'checker.env'), 'utf8')), CACHE_DIR: join(HOME, 'cache') };
    const { main } = await import('../run.mjs');
    status({ summary: await main({ e, log }) });
  } catch (err) {
    const msg = String(err && err.message || err);
    log('error: ' + msg); status({ error: msg }); process.exitCode = 1;
  } finally { release(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--status')) {
    let text = ''; try { text = readFileSync(join(HOME, 'status.txt'), 'utf8'); } catch {}
    console.log(describeStatus(text));
  } else run();
}
