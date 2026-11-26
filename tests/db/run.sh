#!/usr/bin/env bash
# Applies every Cardstead SQL file, in order, to an empty PostgreSQL and checks account deletion. CI only
# (ubuntu runners ship PostgreSQL). Usage: bash tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
sudo systemctl start postgresql.service
sudo -u postgres dropdb --if-exists cardstead_test
sudo -u postgres createdb cardstead_test
run() { echo "== $1"; sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d cardstead_test < "$1"; }
run tests/db/stub.sql
run cloud-schema.sql
for f in migrations/*.sql; do run "$f"; done
run migrations/007-delete-account.sql   # safe to run again
run tests/db/delete-account.sql
