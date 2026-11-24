// Cardstead shop checker on the owner's Windows PC (a home address; Shopify refuses cloud and datacenter addresses).
// Task Scheduler starts it every 2 minutes, hidden, only while the PC is on (install-windows.ps1). One pass, same code
// and rules as the server checker (../run.mjs). Settings, including the one secret CHECKER_KEY line, come from a file
// that only the owner's Windows account can read: %LOCALAPPDATA%\Cardstead\checker\checker.env.
// Output goes to %LOCALAPPDATA%\Cardstead\checker\logs\checker.log (kept under 1 MB, one older file kept).
import { readFileSync, appendFileSync, statSync, renameSync, mkdirSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
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

async function run() {
  const log = fileLog(join(HOME, 'logs', 'checker.log'));
  const release = lock(join(HOME, 'pass.lock'));
  if (!release) { log('previous pass still running, skipped'); return; }
  try {
    // Only the installed copy updates itself: never reset a developer checkout that happens to run this file.
    const appDir = resolve(here, '..', '..', '..');
    if (isInstalledCopy(appDir) && existsSync(join(appDir, '.git'))) selfUpdate(appDir, log);
    const e = { ...process.env, ...parseEnv(readFileSync(join(HOME, 'checker.env'), 'utf8')), CACHE_DIR: join(HOME, 'cache') };
    const { main } = await import('../run.mjs');
    await main({ e, log });
  } catch (err) {
    log('error: ' + String(err && err.message || err)); process.exitCode = 1;
  } finally { release(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) run();
