#!/bin/sh
set -eu

# Stage 8 disposable local rehearsal. This script never links to or accepts a
# remote Supabase project. It creates a fresh project below /private/tmp and
# leaves a successful stack running for browser E2E.

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
for command_name in supabase docker node npm; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Missing required local tool: $command_name" >&2
    exit 1
  }
done
docker info >/dev/null 2>&1 || {
  echo "Docker-compatible runtime is not running" >&2
  exit 1
}

STAGE8_WORK_DIR=$(mktemp -d /private/tmp/soundvillage-stage8.XXXXXX)
STAGE8_ENV_FILE="$STAGE8_WORK_DIR/.stage8-local.env"
STAGE8_START_LOG="$STAGE8_WORK_DIR/supabase-start.log"
STAGE8_PROJECT_ID=$(basename "$STAGE8_WORK_DIR" | tr '.[:upper:]' '-[:lower:]')
STAGE8_FAILED=true

cleanup_on_failure() {
  if [ "$STAGE8_FAILED" = true ] && [ -f "$STAGE8_WORK_DIR/supabase/config.toml" ]; then
    (cd "$STAGE8_WORK_DIR" && supabase stop --no-backup >/dev/null 2>&1) || true
    echo "Stage 8 failed. The disposable stack was stopped; restart from a new directory." >&2
  fi
}
trap cleanup_on_failure EXIT HUP INT TERM

cd "$STAGE8_WORK_DIR"
supabase init >/dev/null
perl -0pi -e "s/^project_id = .*$/project_id = \"$STAGE8_PROJECT_ID\"/m; s/^enable_anonymous_sign_ins = false$/enable_anonymous_sign_ins = true/m" supabase/config.toml
mkdir -p supabase/migrations

wrap_historical() {
  source_file=$1
  destination_file=$2
  {
    printf '%s\n' 'begin;'
    sed -n '1,$p' "$source_file"
    printf '%s\n' 'commit;'
  } > "$destination_file"
}

wrap_historical "$REPO_ROOT/scripts/core_schema.sql" supabase/migrations/20260911000100_core_schema.sql
wrap_historical "$REPO_ROOT/scripts/currency_schema.sql" supabase/migrations/20260911000200_currency_schema.sql
wrap_historical "$REPO_ROOT/scripts/shop_schema.sql" supabase/migrations/20260911000300_shop_schema.sql
wrap_historical "$REPO_ROOT/scripts/daily_quest_schema.sql" supabase/migrations/20260911000400_daily_quest_schema.sql
wrap_historical "$REPO_ROOT/scripts/attendance_schema.sql" supabase/migrations/20260911000500_attendance_schema.sql
wrap_historical "$REPO_ROOT/scripts/interior_decor_schema.sql" supabase/migrations/20260911000600_interior_decor_schema.sql
wrap_historical "$REPO_ROOT/scripts/house_decor_schema.sql" supabase/migrations/20260911000700_house_decor_schema.sql
cp "$REPO_ROOT/scripts/security/local-test-only-house-compatibility.sql" supabase/migrations/20260911000800_local_test_only_house_compatibility.sql
cp "$REPO_ROOT/scripts/security/local-test-only-quest-compatibility.sql" supabase/migrations/20260911000850_local_test_only_quest_compatibility.sql
cp "$REPO_ROOT/scripts/security/001_auth_foundation.sql" supabase/migrations/20260911000900_auth_foundation.sql

supabase start >"$STAGE8_START_LOG" 2>&1
chmod 600 "$STAGE8_START_LOG"
supabase db reset --local
supabase status -o env >"$STAGE8_ENV_FILE"
chmod 600 "$STAGE8_ENV_FILE"
# The generated file is local CLI output in a random /private/tmp directory.
# shellcheck disable=SC1090
. "$STAGE8_ENV_FILE"

node --input-type=module -e "import {requireLoopbackSupabaseUrl} from '$REPO_ROOT/scripts/security/local-supabase-guard.mjs'; await requireLoopbackSupabaseUrl(process.argv[1],'local API URL')" "$API_URL"

STAGE8_DB_CONTAINER=$(docker ps --format '{{.Names}}' | awk -v name="supabase_db_$STAGE8_PROJECT_ID" '$0==name {print; exit}')
[ -n "$STAGE8_DB_CONTAINER" ] || {
  echo "Could not identify the disposable local database container" >&2
  exit 1
}
docker exec "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -Atqc "select case when inet_server_addr() is null then 'local-unix-socket' else 'unexpected-network-connection' end" | grep -qx local-unix-socket

STAGE8_SUFFIX=$(node -e "process.stdout.write(crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase())")
STAGE8_REGISTRY="$STAGE8_WORK_DIR/participants.csv"
printf 'participant_id,group_id\nBOOT_A_%s,A\nBOOT_B_%s,B\n' "$STAGE8_SUFFIX" "$STAGE8_SUFFIX" >"$STAGE8_REGISTRY"
chmod 600 "$STAGE8_REGISTRY"
CONFIRM_STUDY_DATA_SYNC=true REQUIRE_LOOPBACK_SUPABASE=true \
  PARTICIPANT_REGISTRY_FILE="$STAGE8_REGISTRY" NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  node "$REPO_ROOT/scripts/security/register-study-data.mjs"

run_sql() {
  docker exec -i "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$1"
}

run_sql "$REPO_ROOT/scripts/security/transactional-integrity-preflight.sql"
cp "$REPO_ROOT/scripts/security/002_enforce_participant_rls.sql" supabase/migrations/20260911001000_enforce_participant_rls.sql
cp "$REPO_ROOT/scripts/security/003_transactional_integrity.sql" supabase/migrations/20260911001100_transactional_integrity.sql
supabase migration up --local
run_sql "$REPO_ROOT/scripts/security/user-event-logging-preflight.sql"
cp "$REPO_ROOT/scripts/security/004_user_event_logging.sql" supabase/migrations/20260911001200_user_event_logging.sql
cp "$REPO_ROOT/scripts/security/005_functional_fixes.sql" supabase/migrations/20260911001300_functional_fixes.sql
supabase migration up --local
run_sql "$REPO_ROOT/scripts/security/experiment-rules-preflight.sql"
cp "$REPO_ROOT/scripts/security/006_experiment_rules_and_uniqueness.sql" supabase/migrations/20260911001400_experiment_rules.sql
supabase migration up --local
cp "$REPO_ROOT/scripts/security/007_participant_room_rpc_only.sql" supabase/migrations/20260911001500_participant_room_rpc_only.sql
supabase migration up --local

run_sql "$REPO_ROOT/scripts/security/user-event-logging-verify.sql"
run_sql "$REPO_ROOT/scripts/security/experiment-rules-verify.sql"

STAGE8_SCHEMA_INVENTORY="$STAGE8_WORK_DIR/schema-inventory.json"
docker exec -i "$STAGE8_DB_CONTAINER" psql -X -q -A -t -U postgres -d postgres \
  < "$REPO_ROOT/scripts/security/schema-reconciliation-snapshot.sql" > "$STAGE8_SCHEMA_INVENTORY"
chmod 600 "$STAGE8_SCHEMA_INVENTORY"
node "$REPO_ROOT/scripts/security/schema-reconciliation-validator.mjs" "$STAGE8_SCHEMA_INVENTORY"

ROOM_BOUNDARY=$(docker exec "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -Atqc \
  "select concat_ws('/', has_table_privilege('authenticated','public.participant_room','INSERT'), has_table_privilege('authenticated','public.participant_room','UPDATE'), has_table_privilege('authenticated','public.participant_room','DELETE'), has_table_privilege('authenticated','public.participant_room','TRUNCATE'), has_table_privilege('anon','public.participant_room','TRUNCATE'), exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='public.participant_room'::regclass and a.grantee=0 and a.privilege_type='TRUNCATE'), exists(select 1 from pg_policies where schemaname='public' and tablename='participant_room' and cmd in ('INSERT','UPDATE','DELETE')));")
[ "$ROOM_BOUNDARY" = "f/f/f/f/f/f/f" ] || {
  echo "Participant room RPC-only grant/policy verification failed" >&2
  exit 1
}

export SECURITY_TEST_SUPABASE_URL="$API_URL"
export SECURITY_TEST_SUPABASE_ANON_KEY="$ANON_KEY"
export SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
cd "$REPO_ROOT"
npm run test:rls-local
npm run test:transactional-integrity-local
npm run test:user-events-local
npm run test:experiment-rules-local

docker exec "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "delete from public.study_participants where participant_id in ('BOOT_A_$STAGE8_SUFFIX','BOOT_B_$STAGE8_SUFFIX');" >/dev/null
CATALOG_COUNTS=$(docker exec "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -Atqc \
  "select count(*)::text||'/'||count(distinct canonical_audio_id)::text from public.study_sound_catalog")
[ "$CATALOG_COUNTS" = "1000/995" ] || {
  echo "Catalog cleanup verification failed: $CATALOG_COUNTS" >&2
  exit 1
}
AUTH_USER_COUNT=$(docker exec "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -Atqc \
  "select count(*) from auth.users")
QA_PARTICIPANT_COUNT=$(docker exec "$STAGE8_DB_CONTAINER" psql -U postgres -d postgres -Atqc \
  "select count(*) from public.study_participants where participant_id ~ '^(BOOT|RLS|TX|EVENT|RULE)_[AB]_[A-Z0-9]+$'")
[ "$AUTH_USER_COUNT/$QA_PARTICIPANT_COUNT" = "0/0" ] || {
  echo "QA cleanup verification failed: auth=$AUTH_USER_COUNT participants=$QA_PARTICIPANT_COUNT" >&2
  exit 1
}

{
  printf 'NEXT_PUBLIC_SUPABASE_URL=%s\n' "$API_URL"
  printf 'NEXT_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$ANON_KEY"
  printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$SERVICE_ROLE_KEY"
  printf 'ENABLE_INTERNAL_TEST_ROUTES=true\n'
} > "$STAGE8_WORK_DIR/app-local.env"
chmod 600 "$STAGE8_WORK_DIR/app-local.env"

STAGE8_FAILED=false
echo "Stage 8 database rehearsal passed on loopback."
echo "Disposable project: $STAGE8_WORK_DIR"
echo "Catalog rows/canonical identities after cleanup: $CATALOG_COUNTS"
echo "QA auth users/participants after cleanup: $AUTH_USER_COUNT/$QA_PARTICIPANT_COUNT"
echo "The local stack remains running for browser E2E; generated keys stay in the protected temporary directory."
