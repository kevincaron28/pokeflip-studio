#!/usr/bin/env bash
# Install the Cardstead shop checker on the Guilded-DB Oracle VM (Ubuntu 24.04, x86_64), as root:
#   sudo bash install.sh
# Safe to run again: it never overwrites /etc/cardstead-checker/checker.env.
# It does not handle the checker key and does not start the timer: the owner pastes the one CHECKER_KEY line into the
# root-only settings file, then the first pass is run by hand (docs/SHOP-CHECKER-VM.md).
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-24.21.0}"
REPO="${CARDSTEAD_REPO:-https://github.com/kevincaron28/pokeflip-studio.git}"
ROOT=/opt/cardstead-checker
ENV_DIR=/etc/cardstead-checker
ENV_FILE=$ENV_DIR/checker.env
MIN_AVAILABLE_MB="${MIN_AVAILABLE_MB:-250}"

[ "$(id -u)" = 0 ] || { echo "run as root: sudo bash $0"; exit 1; }
[ "$(uname -m)" = x86_64 ] || { echo "this script installs the x86_64 Node build; adapt it first"; exit 1; }

echo "== memory"
# PostgreSQL is this VM's main job. The checker needs under 200 MB (its service is capped at 192 MB).
avail=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
swap=$(awk '/^SwapTotal:/ {print int($2/1024)}' /proc/meminfo)
echo "available now: ${avail} MB, swap: ${swap} MB"
free -m
if [ "$avail" -lt "$MIN_AVAILABLE_MB" ] && [ "${FORCE:-0}" != 1 ]; then
  echo "less than ${MIN_AVAILABLE_MB} MB available: stopping so PostgreSQL is not squeezed. Look at 'free -m' and"
  echo "'ps -eo rss,comm --sort=-rss | head', then decide; FORCE=1 sudo -E bash $0 to install anyway."
  exit 1
fi
[ "$swap" -gt 0 ] || echo "note: no swap file. The Goblin Ledger install adds a 2 GB one; consider the same."

echo "== packages"
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git xz-utils ca-certificates curl >/dev/null

echo "== node $NODE_VERSION"
# Shared with the Goblin Ledger collector when it is already installed at /opt/node.
if ! /opt/node/bin/node -v >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  file="node-v${NODE_VERSION}-linux-x64.tar.xz"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${file}" -o "$tmp/$file"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  (cd "$tmp" && grep " ${file}\$" SHASUMS256.txt | sha256sum -c --quiet -)
  tar -xJf "$tmp/$file" -C /opt
  ln -sfn "/opt/node-v${NODE_VERSION}-linux-x64" /opt/node
  rm -rf "$tmp"
fi
/opt/node/bin/node -v

echo "== user and folders"
id cardstead >/dev/null 2>&1 || useradd --system --home-dir "$ROOT" --shell /usr/sbin/nologin cardstead
install -d -o cardstead -g cardstead -m 0755 "$ROOT"
# Settings are root-only: systemd reads the EnvironmentFile as root before it starts the pass as user cardstead.
install -d -o root -g root -m 0700 "$ENV_DIR"

echo "== code (only the checker files)"
if [ ! -d "$ROOT/app/.git" ]; then
  sudo -u cardstead git clone -q --depth 1 --filter=blob:none --sparse --branch main "$REPO" "$ROOT/app"
  sudo -u cardstead git -C "$ROOT/app" sparse-checkout set supabase/functions/_shared deploy/shop-checker
fi
chmod 0755 "$ROOT/app/deploy/shop-checker/run.sh"

echo "== settings"
if [ ! -f "$ENV_FILE" ]; then
  install -o root -g root -m 0600 "$ROOT/app/deploy/shop-checker/checker.env.example" "$ENV_FILE"
  echo "created $ENV_FILE (root only)"
fi
chown root:root "$ENV_FILE"; chmod 0600 "$ENV_FILE"
if grep -Eq '^CHECKER_KEY=[0-9a-f]{64}$' "$ENV_FILE"; then key_state="present"; else key_state="missing"; fi

echo "== systemd"
install -m 0644 "$ROOT/app/deploy/shop-checker/cardstead-checker.service" /etc/systemd/system/
install -m 0644 "$ROOT/app/deploy/shop-checker/cardstead-checker.timer" /etc/systemd/system/
systemctl daemon-reload

cat <<EOF

Installed. CHECKER_KEY: $key_state. The timer is NOT on yet.
Next (docs/SHOP-CHECKER-VM.md):
 3. Supabase > SQL Editor: run migrations/006-checker-key.sql (once), then:
      select public.checker_new_key('oracle-guilded-db');
    It shows the key once. On this VM:  sudo nano $ENV_FILE
    and put it after CHECKER_KEY= (that one line is the only secret). Save: Ctrl+O, Enter, Ctrl+X.
 4. Pause (do not delete) the Supabase cron job shop-checker-tick.
 5. First pass by hand:  sudo systemctl start cardstead-checker.service && sudo journalctl -u cardstead-checker -n 30 --no-pager
    then the timer:      sudo systemctl enable --now cardstead-checker.timer
EOF
