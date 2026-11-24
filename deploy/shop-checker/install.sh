#!/usr/bin/env bash
# Install the Cardstead shop checker on the Guilded-DB Oracle VM (Ubuntu 24.04, x86_64), as root:
#   sudo bash install.sh
# Safe to run again: it never overwrites /etc/cardstead-checker/checker.env or its CHECKER_KEY.
# It makes the checker key here, prints only its SHA-256 for Supabase, and does not start the timer
# (docs/SHOP-CHECKER-VM.md, steps 3-5).
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
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git xz-utils ca-certificates curl openssl >/dev/null

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
install -d -o root -g cardstead -m 0750 "$ENV_DIR"

echo "== code (only the checker files)"
if [ ! -d "$ROOT/app/.git" ]; then
  sudo -u cardstead git clone -q --depth 1 --filter=blob:none --sparse --branch main "$REPO" "$ROOT/app"
  sudo -u cardstead git -C "$ROOT/app" sparse-checkout set supabase/functions/_shared deploy/shop-checker
fi
chmod 0755 "$ROOT/app/deploy/shop-checker/run.sh"

echo "== settings"
if [ ! -f "$ENV_FILE" ]; then
  install -o root -g cardstead -m 0640 "$ROOT/app/deploy/shop-checker/checker.env.example" "$ENV_FILE"
  echo "created $ENV_FILE"
fi
if ! grep -Eq '^CHECKER_KEY=[0-9a-f]{64}$' "$ENV_FILE"; then
  key=$(openssl rand -hex 32)
  sed -i "s/^CHECKER_KEY=.*/CHECKER_KEY=${key}/" "$ENV_FILE"
  unset key
  echo "made a new CHECKER_KEY in $ENV_FILE (not shown)"
fi
hash=$(grep -E '^CHECKER_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\n' | sha256sum | cut -d' ' -f1)

echo "== systemd"
install -m 0644 "$ROOT/app/deploy/shop-checker/cardstead-checker.service" /etc/systemd/system/
install -m 0644 "$ROOT/app/deploy/shop-checker/cardstead-checker.timer" /etc/systemd/system/
systemctl daemon-reload

cat <<EOF

Installed. The timer is NOT on yet.
Next (docs/SHOP-CHECKER-VM.md):
 3. Supabase > SQL Editor: run migrations/006-checker-key.sql (once), then this line (the key's SHA-256, not the key):
      insert into public.checker_keys (label, token_hash) values ('oracle-guilded-db', '${hash}');
 4. Turn off the Supabase cron job shop-checker-tick (two checkers must not run at once).
 5. First pass by hand:  sudo systemctl start cardstead-checker.service && sudo journalctl -u cardstead-checker -n 30 --no-pager
    then the timer:      sudo systemctl enable --now cardstead-checker.timer
EOF
