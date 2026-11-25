#!/usr/bin/env bash
# Gate runner — 06 §5 "Definition of done, every milestone".
#
#   GATE=1 bar scripts/gate.sh                      # M1: single spec subset
#   E2E_SPECS="e2e/shell.spec.ts e2e/resize.spec.ts" GATE=2 bar scripts/gate.sh
#   GATE=5 bar scripts/gate.sh                      # all specs
#
# Runs typecheck, lint, format check, unit tests, build (which includes the
# gzip size gate) and the Playwright suite, appends every command's output to
# docs/build/evidence/gate-<n>.log, and exits non-zero if anything is red.
# The gate report (docs/build/GATE-<n>.md) quotes this log.
set -uo pipefail

GATE="${GATE:-1}"
cd "$(dirname "$0")/.." || exit 1

EVIDENCE_DIR="docs/build/evidence"
LOG="$EVIDENCE_DIR/gate-${GATE}.log"
mkdir -p "$EVIDENCE_DIR"
: >"$LOG"

declare -a passed=()
declare -a failed=()

run_step() {
  local label="$1"
  shift
  printf '\n### %s\n' "$label" | tee -a "$LOG"
  "$@" >>"$LOG" 2>&1
  local code=$?
  if [ "$code" -eq 0 ]; then
    passed+=("$label")
    printf 'PASS  %s\n' "$label"
  else
    failed+=("$label (exit $code)")
    printf 'FAIL  %s (exit %d)\n' "$label" "$code"
    tail -n 25 "$LOG"
  fi
}

run_step "pnpm typecheck (tsc -b)" pnpm typecheck
run_step "pnpm lint (oxlint)" pnpm lint
run_step "pnpm format:check (oxfmt)" pnpm format:check
run_step "pnpm test (vitest run)" pnpm test
run_step "pnpm build (tsc -b + vite build + size gate)" pnpm build

# Start one isolated preview server for this gate on PW_PORT (default 4273).
# Playwright's own webServer is disabled (PW_EXTERNAL_SERVER=1): a concurrent
# `pnpm e2e` or a stale preview on 4173 must not be able to take the gate's
# server down mid-run, and `vite preview` must not reuse a cached index.html
# from before `pnpm build`.
export PW_PORT="${PW_PORT:-4273}"
export PW_EXTERNAL_SERVER=1
PREVIEW_LOG="$EVIDENCE_DIR/preview-${GATE}.log"
PREVIEW_PID=""
cleanup_preview() {
  if [ -n "$PREVIEW_PID" ] && kill -0 "$PREVIEW_PID" 2>/dev/null; then
    kill "$PREVIEW_PID" 2>/dev/null || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
}
trap cleanup_preview EXIT

pnpm preview --port "$PW_PORT" --strictPort >"$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!

preview_ready=0
for _ in $(seq 1 60); do
  if curl --silent --fail "http://127.0.0.1:${PW_PORT}/" >/dev/null 2>&1; then
    preview_ready=1
    break
  fi
  sleep 1
done
if [ "$preview_ready" -ne 1 ]; then
  printf 'preview server on port %s did not become ready — see %s\n' "$PW_PORT" "$PREVIEW_LOG" | tee -a "$LOG"
  failed+=("preview server (port $PW_PORT)")
fi

if [ -n "${E2E_SPECS:-}" ]; then
  # shellcheck disable=SC2086 # the spec list is intentionally word-split
  run_step "pnpm exec playwright test ${E2E_SPECS}" env PLAYWRIGHT_BROWSERS_PATH=0 PW_PORT="$PW_PORT" PW_EXTERNAL_SERVER=1 pnpm exec playwright test ${E2E_SPECS} --workers=1
else
  run_step "pnpm exec playwright test (all specs)" env PLAYWRIGHT_BROWSERS_PATH=0 PW_PORT="$PW_PORT" PW_EXTERNAL_SERVER=1 pnpm exec playwright test --workers=1
fi

printf '\n================ GATE %s SUMMARY ================\n' "$GATE" | tee -a "$LOG"
for step in "${passed[@]}"; do
  printf 'PASS  %s\n' "$step" | tee -a "$LOG"
done
if [ "${#failed[@]}" -gt 0 ]; then
  for step in "${failed[@]}"; do
    printf 'FAIL  %s\n' "$step" | tee -a "$LOG"
  done
  printf '\nGATE %s: FAIL — see %s\n' "$GATE" "$LOG"
  exit 1
fi
printf '\nGATE %s: PASS — full log: %s\n' "$GATE" "$LOG"
