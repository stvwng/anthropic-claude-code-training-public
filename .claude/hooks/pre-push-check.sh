#!/usr/bin/env bash
# PreToolUse hook (Bash): before any `git push`, run the merchant console's
# tests and build. Exit 2 blocks the push and the stderr text is shown to
# Claude; exit 0 lets it through. Every other command passes straight through.

set -u

input="$(cat)"

# If the payload can't be parsed, this isn't a push we can identify: let it run.
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)" || exit 0
[ -n "$command" ] || exit 0

# `git` must start a command (line start, or after ; & | or a subshell paren),
# so `echo git push` or `git log --grep push` don't trigger a full build.
# Matches `git push`, `git -C dir push`, `git -c k=v push`.
push_pattern='(^|[;&|(])[[:space:]]*git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+push([[:space:];&|)]|$)'
if ! printf '%s' "$command" | grep -Eq "$push_pattern"; then
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
app_dir="$project_dir/build-battle/merchant-console"
log_dir="${TMPDIR:-/tmp}/claude-pre-push/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$log_dir"
test_log="$log_dir/test.log"
build_log="$log_dir/build.log"

timestamp() { date -u +%Y-%m-%dT%H:%M:%SZ; }

if [ ! -d "$app_dir" ]; then
  echo "[pre-push-check] $(timestamp) push blocked: app directory not found at $app_dir" >&2
  exit 2
fi

# Tests first: they take a second, the build takes much longer.
if ! (cd "$app_dir" && npm test) >"$test_log" 2>&1; then
  {
    echo "[pre-push-check] $(timestamp) push blocked: TESTS FAILED (build not run)."
    echo "Summary:"
    grep -E "FAIL|×|Tests |Test Files" "$test_log" | head -15
    echo "Full output: $test_log"
    echo "Re-run: cd $app_dir && npm test"
  } >&2
  exit 2
fi

if ! (cd "$app_dir" && npm run build) >"$build_log" 2>&1; then
  {
    echo "[pre-push-check] $(timestamp) push blocked: BUILD FAILED (tests passed)."
    echo "Last lines:"
    tail -15 "$build_log"
    echo "Full output: $build_log"
    echo "Re-run: cd $app_dir && npm run build"
  } >&2
  exit 2
fi

tests_line="$(grep -E "Tests " "$test_log" | tail -1 | sed 's/^[[:space:]]*//')"
printf '{"systemMessage": "pre-push-check: tests passed (%s) and build succeeded; push allowed. Logs: %s"}\n' \
  "$tests_line" "$log_dir"
exit 0
