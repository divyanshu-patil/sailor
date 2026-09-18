#!/bin/sh
# Force-regenerate the daily practice content buffer.
#
# An ops tool, not something the app calls — see app/api/v1/admin_router.py.
# Use it when the prompt or the framework library changed and the buffered
# content is stale rather than missing; the normal refill only fills gaps, so it
# would leave stale days in place indefinitely.
#
# Today's content is NOT replaced by default — a regeneration is normally run
# because the next few days are wrong, and rewriting the day people are already
# practising changes the snippet under them mid-session. Pass --force-override
# when you really do mean today as well.
#
#   pnpm practice:regenerate
#   pnpm practice:regenerate -- --force-override
#   DAYS=14 pnpm practice:regenerate
#   DAILY_PRACTICE_API_URL=https://api.example.com pnpm practice:regenerate
set -eu

OVERRIDE_TODAY=false
for arg in "$@"; do
  case "$arg" in
    --force-override) OVERRIDE_TODAY=true ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--force-override]" >&2
      exit 2
      ;;
  esac
done

API_URL="${DAILY_PRACTICE_API_URL:-http://localhost:3000}"
DAYS="${DAYS:-7}"
ENV_FILE="${ENV_FILE:-.env}"

echo "[daily-practice] Starting content regeneration..."
echo "[daily-practice] API: $API_URL"
echo "[daily-practice] Days: $DAYS"

# Read the one key out of .env rather than sourcing the file. Sourcing runs it,
# and this .env holds a PEM public key whose value breaks `sh` outright — quite
# apart from executing whatever else a teammate has put in there.
if [ -z "${DAILY_PRACTICE_ADMIN_SECRET:-}" ] && [ -f "$ENV_FILE" ]; then
  DAILY_PRACTICE_ADMIN_SECRET=$(
    sed -n 's/^[[:space:]]*DAILY_PRACTICE_ADMIN_SECRET[[:space:]]*=[[:space:]]*//p' "$ENV_FILE" \
      | tail -1 \
      | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
  )
fi

if [ -z "${DAILY_PRACTICE_ADMIN_SECRET:-}" ]; then
  echo "[daily-practice] ERROR: DAILY_PRACTICE_ADMIN_SECRET is not set." >&2
  echo "Add it to $ENV_FILE (the API needs it too — an empty value disables the route)." >&2
  echo "Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'" >&2
  exit 1
fi

echo "[daily-practice] Sending regeneration request..."

# --fail-with-body so a 401 exits non-zero but still prints what the server said.
# The secret goes in a header, never in the URL — URLs land in access logs and
# shell history.
curl -sS --fail-with-body -X POST \
  "$API_URL/api/v1/admin/daily-content/regenerate?days=$DAYS&override_today=$OVERRIDE_TODAY" \
  -H "X-Admin-Secret: $DAILY_PRACTICE_ADMIN_SECRET"

echo
if [ "$OVERRIDE_TODAY" = "true" ]; then
  echo "[daily-practice] Today's content WILL be replaced (--force-override)."
else
  echo "[daily-practice] Today's content was left alone (pass --force-override to replace it)."
fi
echo "[daily-practice] Regeneration completed successfully."