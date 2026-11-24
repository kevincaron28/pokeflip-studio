#!/usr/bin/env bash
# One shop-checker pass. Started by cardstead-checker.service (user cardstead). Updates the code from main at most
# once an hour (a shallow, sparse copy: only the checker files), then runs one pass. Secrets come from the
# EnvironmentFile and are never printed.
set -euo pipefail
APP=/opt/cardstead-checker/app
stamp="$APP/.git/FETCH_HEAD"
if [ ! -f "$stamp" ] || [ $(( $(date +%s) - $(stat -c %Y "$stamp") )) -gt 3600 ]; then
  if git -C "$APP" fetch -q --depth 1 origin main; then git -C "$APP" reset -q --hard FETCH_HEAD; else echo "code update skipped (fetch failed)"; fi
fi
exec node "$APP/deploy/shop-checker/run.mjs"
