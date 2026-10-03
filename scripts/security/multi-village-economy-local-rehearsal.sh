#!/bin/sh
set -eu

# Migrations 008-012 have a narrower lifecycle than the reusable Stage 8 browser
# bootstrap: they must compare legacy fingerprints, run concurrent DB checks and
# HTTP/browser boundaries, then destroy the stack. Keeping this wrapper separate
# avoids weakening or changing any 001-007 checks in stage8-local-bootstrap.sh.

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
for command_name in supabase docker node npm curl cmp diff sed rsync; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Missing required local tool: $command_name" >&2
    exit 1
  }
done

docker info >/dev/null 2>&1 || {
  echo "Docker-compatible runtime is not running" >&2
  exit 1
}

REHEARSAL_CONTROL_DIR=$(mktemp -d /private/tmp/soundvillage-economy-control.XXXXXX)
chmod 700 "$REHEARSAL_CONTROL_DIR"
BOOTSTRAP_LOG="$REHEARSAL_CONTROL_DIR/bootstrap.log"
STAGE8_WORK_DIR=''
NEXT_PID=''
REHEARSAL_OK=false
REHEARSAL_STAGE='tool preflight'

cleanup() {
  if [ -n "$NEXT_PID" ]; then
    kill "$NEXT_PID" >/dev/null 2>&1 || true
    wait "$NEXT_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$STAGE8_WORK_DIR" ]; then
    case "$STAGE8_WORK_DIR" in
      /private/tmp/soundvillage-stage8.*)
        if [ -f "$STAGE8_WORK_DIR/supabase/config.toml" ]; then
          (cd "$STAGE8_WORK_DIR" && supabase stop --no-backup >/dev/null 2>&1) || true
        fi
        rm -rf -- "$STAGE8_WORK_DIR"
        ;;
      *) echo "Refusing to clean unexpected rehearsal path: $STAGE8_WORK_DIR" >&2 ;;
    esac
  fi
  rm -rf -- "$REHEARSAL_CONTROL_DIR"
  if [ "$REHEARSAL_OK" != true ]; then
    echo "Multi-village economy rehearsal failed at: $REHEARSAL_STAGE" >&2
    echo "Its disposable local stack and temporary secrets were removed." >&2
  fi
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

cd "$REPO_ROOT"
REHEARSAL_STAGE='001-007 disposable bootstrap'
sh scripts/security/stage8-local-bootstrap.sh | tee "$BOOTSTRAP_LOG"
STAGE8_WORK_DIR=$(sed -n 's/^Disposable project: //p' "$BOOTSTRAP_LOG" | tail -1)
case "$STAGE8_WORK_DIR" in
  /private/tmp/soundvillage-stage8.*) ;;
  *) echo "Could not resolve the disposable Stage 8 project" >&2; exit 1 ;;
esac

STAGE8_ENV_FILE="$STAGE8_WORK_DIR/.stage8-local.env"
# shellcheck disable=SC1090
. "$STAGE8_ENV_FILE"
node --input-type=module -e "import {requireLoopbackSupabaseUrl} from '$REPO_ROOT/scripts/security/local-supabase-guard.mjs'; await requireLoopbackSupabaseUrl(process.argv[1],'local API URL')" "$API_URL"

STAGE8_ID=$(basename "$STAGE8_WORK_DIR" | tr '.[:upper:]' '-[:lower:]')
STAGE8_DB_CONTAINER="supabase_db_$STAGE8_ID"
docker inspect "$STAGE8_DB_CONTAINER" >/dev/null

run_sql() {
  docker exec -i "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /dev/stdin < "$1"
}

BEFORE_SNAPSHOT="$REHEARSAL_CONTROL_DIR/legacy-before.json"
AFTER_SNAPSHOT="$REHEARSAL_CONTROL_DIR/legacy-after.json"
FINAL_SNAPSHOT="$REHEARSAL_CONTROL_DIR/legacy-final.json"
docker exec -i "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -X -qAt \
  < scripts/security/multi-village-economy-legacy-snapshot.sql > "$BEFORE_SNAPSHOT"

run_sql scripts/security/multi-village-economy-preflight.sql
REHEARSAL_STAGE='008-012 migration apply'
cp scripts/security/008_multi_village_economy.sql \
  "$STAGE8_WORK_DIR/supabase/migrations/20260929020000_multi_village_economy.sql"
cp scripts/security/009_multi_village_character_loadout.sql \
  "$STAGE8_WORK_DIR/supabase/migrations/20260929030000_multi_village_character_loadout.sql"
cp scripts/security/010_multi_village_runtime_cutover.sql \
  "$STAGE8_WORK_DIR/supabase/migrations/20260930010000_multi_village_runtime_cutover.sql"
cp scripts/security/011_multi_village_interior_cutover.sql \
  "$STAGE8_WORK_DIR/supabase/migrations/20261001010000_multi_village_interior_cutover.sql"
cp scripts/security/012_duo_session_v2.sql \
  "$STAGE8_WORK_DIR/supabase/migrations/20261001020000_duo_session_v2.sql"
supabase migration up --local --workdir "$STAGE8_WORK_DIR"
REHEARSAL_STAGE='008-012 SQL verification'
run_sql scripts/security/multi-village-economy-verify.sql
run_sql scripts/security/multi-village-character-verify.sql
run_sql scripts/security/multi-village-runtime-verify.sql
run_sql scripts/security/multi-village-interior-verify.sql
run_sql scripts/security/duo-session-v2-verify.sql
run_sql scripts/security/multi-village-economy.integration.sql

docker exec -i "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -X -qAt \
  < scripts/security/multi-village-economy-legacy-snapshot.sql > "$AFTER_SNAPSHOT"
cmp -s "$BEFORE_SNAPSHOT" "$AFTER_SNAPSHOT" || {
  echo "Migration 008-012 changed a legacy table, ACL, policy, or function fingerprint" >&2
  exit 1
}

HMAC_ENV_FILE="$STAGE8_WORK_DIR/.multi-village-economy-hmac.env"
umask 077
node -e "process.stdout.write('MULTI_VILLAGE_ECONOMY_HMAC_SECRET='+require('node:crypto').randomBytes(32).toString('hex')+'\\n')" > "$HMAC_ENV_FILE"
chmod 600 "$HMAC_ENV_FILE"
# shellcheck disable=SC1090
. "$HMAC_ENV_FILE"

export SECURITY_TEST_SUPABASE_URL="$API_URL"
export SECURITY_TEST_SUPABASE_ANON_KEY="$ANON_KEY"
export SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export SECURITY_TEST_DB_CONTAINER="$STAGE8_DB_CONTAINER"
export MULTI_VILLAGE_ECONOMY_HMAC_SECRET
SUPABASE_JWT_SECRET=${JWT_SECRET:?Disposable Supabase JWT secret is missing}
export SUPABASE_JWT_SECRET
DUO_SESSION_HMAC_SECRET=$(node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))")
export DUO_SESSION_HMAC_SECRET

REHEARSAL_STAGE='Quest and attendance reliability unit contract'
npm run test:quest-attendance
REHEARSAL_STAGE='Quest and attendance DB integrity'
npm run test:quest-attendance-local
REHEARSAL_STAGE='Economy and Interior DB integration'
node scripts/security/multi-village-economy.integration.mjs
node scripts/security/multi-village-character.integration.mjs
node scripts/security/multi-village-runtime.integration.mjs
npm run test:multi-village-interior-local
REHEARSAL_STAGE='Duo V2 DB concurrency and WebSocket authorization'
npm run test:duo-v2-local
npm run test:duo-v2-realtime-local
REHEARSAL_STAGE='legacy RLS, transactions, events, and experiment regression'
npm run test:rls-local
npm run test:transactional-integrity-local
npm run test:user-events-local
npm run test:experiment-rules-local

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export ENABLE_INTERNAL_TEST_ROUTES=true

# Keep browser verification independent from an already-running user dev server
# and its .next/dev lock. Webpack is intentional because node_modules remains an
# external symlink in this disposable copy.
APP_WORK_DIR="$REHEARSAL_CONTROL_DIR/app"
mkdir -p "$APP_WORK_DIR"
rsync -a --delete \
  --exclude='.git' --exclude='.next' --exclude='node_modules' --exclude='_review' --exclude='tmp' \
  "$REPO_ROOT/" "$APP_WORK_DIR/"
ln -s "$REPO_ROOT/node_modules" "$APP_WORK_DIR/node_modules"

start_app() {
  SOUNDVILLAGE_ECONOMY_MODE=$1
  SERVER_KIND=${2:-development}
  export SOUNDVILLAGE_ECONOMY_MODE
  APP_PORT=$(node -e "const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close()})")
  ECONOMY_TEST_APP_URL="http://127.0.0.1:$APP_PORT"
  export ECONOMY_TEST_APP_URL
  NEXT_LOG="$REHEARSAL_CONTROL_DIR/next-$1.log"
  if [ "$SERVER_KIND" = production ]; then
    (cd "$APP_WORK_DIR" && exec "$REPO_ROOT/node_modules/.bin/next" start --hostname 127.0.0.1 --port "$APP_PORT") > "$NEXT_LOG" 2>&1 &
  else
    (cd "$APP_WORK_DIR" && exec "$REPO_ROOT/node_modules/.bin/next" dev --webpack --hostname 127.0.0.1 --port "$APP_PORT") > "$NEXT_LOG" 2>&1 &
  fi
  NEXT_PID=$!
  APP_READY=false
  attempt=0
  while [ "$attempt" -lt 60 ]; do
    # A 401 is the expected unauthenticated bootstrap response and proves the
    # route is compiled. Capture the status explicitly because the local curl
    # build can report a non-zero transport status after receiving that body.
    HTTP_STATUS=$(curl --silent --output /dev/null --write-out '%{http_code}' \
      "$ECONOMY_TEST_APP_URL/api/economy-v1/bootstrap" || true)
    case "$HTTP_STATUS" in
      200|401|404|503)
        curl --silent --output /dev/null "$ECONOMY_TEST_APP_URL/" || true
        APP_READY=true
        break
        ;;
    esac
    if ! kill -0 "$NEXT_PID" >/dev/null 2>&1; then
      echo "Local Next server exited before the $1 rehearsal" >&2
      sed -n '1,200p' "$NEXT_LOG" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  [ "$APP_READY" = true ] || {
    echo "Local Next server did not become ready for $1" >&2
    sed -n '1,200p' "$NEXT_LOG" >&2
    exit 1
  }
}

stop_app() {
  kill "$NEXT_PID" >/dev/null 2>&1 || true
  wait "$NEXT_PID" >/dev/null 2>&1 || true
  NEXT_PID=''
}

start_app legacy
REHEARSAL_STAGE='legacy browser regression'
EXPECTED_ECONOMY_MODE=legacy npm run test:quest-attendance-browser
EXPECTED_ECONOMY_MODE=legacy node scripts/security/multi-village-main-runtime-browser-e2e.mjs
stop_app

start_app preview
REHEARSAL_STAGE='preview browser regression'
EXPECTED_ECONOMY_MODE=preview npm run test:quest-attendance-browser
EXPECTED_ECONOMY_MODE=preview node scripts/security/multi-village-main-runtime-browser-e2e.mjs
stop_app

start_app maintenance
REHEARSAL_STAGE='maintenance browser regression'
EXPECTED_ECONOMY_MODE=maintenance npm run test:quest-attendance-browser
EXPECTED_ECONOMY_MODE=maintenance node scripts/security/multi-village-main-runtime-browser-e2e.mjs
stop_app

start_app cutover
REHEARSAL_STAGE='cutover HTTP and browser regression'
node scripts/security/multi-village-economy-http.integration.mjs
EXPECTED_ECONOMY_MODE=cutover npm run test:quest-attendance-browser
node scripts/security/multi-village-character-browser-e2e.mjs
EXPECTED_ECONOMY_MODE=cutover node scripts/security/multi-village-main-runtime-browser-e2e.mjs
REHEARSAL_STAGE='Economy Interior product-path browser E2E'
npm run test:multi-village-interior-browser
stop_app

# The internal Character/Interior QA routes are intentionally development-only,
# but a development server may refresh a long-lived Duo tab during compilation.
# Run only the real-root Duo flow on a separately built production copy.
APP_WORK_DIR="$REHEARSAL_CONTROL_DIR/app-duo-production"
mkdir -p "$APP_WORK_DIR"
rsync -a --delete \
  --exclude='.git' --exclude='.next' --exclude='node_modules' --exclude='_review' --exclude='tmp' \
  "$REPO_ROOT/" "$APP_WORK_DIR/"
ln -s "$REPO_ROOT/node_modules" "$APP_WORK_DIR/node_modules"
REHEARSAL_STAGE='isolated Duo production build'
NEXT_BUILD_LOG="$REHEARSAL_CONTROL_DIR/next-build.log"
if ! (cd "$APP_WORK_DIR" && "$REPO_ROOT/node_modules/.bin/next" build --webpack) > "$NEXT_BUILD_LOG" 2>&1; then
  echo "Isolated Next production build failed" >&2
  sed -n '1,240p' "$NEXT_BUILD_LOG" >&2
  exit 1
fi
start_app cutover production
REHEARSAL_STAGE='Duo V2 A/B/C product-path browser E2E'
npm run test:duo-v2-browser
stop_app

REHEARSAL_STAGE='final legacy fingerprint comparison'
docker exec -i "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -X -qAt \
  < scripts/security/multi-village-economy-legacy-snapshot.sql > "$FINAL_SNAPSHOT"
cmp -s "$BEFORE_SNAPSHOT" "$FINAL_SNAPSHOT" || {
  echo "Interior DB, HTTP, or browser checks changed a protected legacy fingerprint" >&2
  diff -u "$BEFORE_SNAPSHOT" "$FINAL_SNAPSHOT" >&2 || true
  exit 1
}

REHEARSAL_STAGE='complete'
REHEARSAL_OK=true
echo "Multi-village economy local rehearsal passed."
echo "Disposable migrations 001-012, Interior and Duo verify/integration/browser/WebSocket checks, legacy fingerprints, concurrency, RLS, HTTP, and all four runtime modes passed."
echo "The disposable Supabase stack and protected temporary secret will now be removed."
