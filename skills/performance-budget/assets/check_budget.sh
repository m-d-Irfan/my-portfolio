#!/usr/bin/env bash
# Performance budget gate. Copy to scripts/check_budget.sh and run in CI after
# `npm run build`.
#
# Exits non-zero on any breach. That is the point — a warning in a log nobody
# reads has never prevented a regression.
#
# Budgets are gzipped sizes, because that is what ships. Measuring raw bytes
# overstates JS by roughly 3x and gives a number nobody can act on.

set -uo pipefail

DIST="${DIST:-dist}"
ASSET_DIRS="${ASSET_DIRS:-src/assets public}"

# --- Budgets (KB, gzipped where noted) -------------------------------------
BUDGET_INITIAL_JS=200     # gzipped
BUDGET_LAZY_CHUNK=150     # gzipped
BUDGET_CSS=50             # gzipped
BUDGET_IMAGE=300          # on disk

fail=0

kb_gz() { gzip -c "$1" 2>/dev/null | wc -c | awk '{printf "%d", $1/1024}'; }
kb()    { wc -c <"$1"            | awk '{printf "%d", $1/1024}'; }

report() {  # name actual budget
  if [ "$2" -gt "$3" ]; then
    printf 'FAIL  %-46s %4s KB  (budget %s KB)\n' "$1" "$2" "$3"
    fail=1
  else
    printf 'ok    %-46s %4s KB  (budget %s KB)\n' "$1" "$2" "$3"
  fi
}

if [ ! -d "$DIST" ]; then
  echo "No $DIST/ — run the build first." >&2
  exit 2
fi

echo "== JavaScript =="

# The initial bundle is the entry chunk. Vite names it index-<hash>.js; adjust
# the pattern if the project renames its entry.
initial_total=0
found_entry=0
for f in "$DIST"/assets/index-*.js; do
  [ -e "$f" ] || continue
  found_entry=1
  initial_total=$(( initial_total + $(kb_gz "$f") ))
done

if [ "$found_entry" -eq 0 ]; then
  echo "FAIL  no entry chunk matched $DIST/assets/index-*.js" >&2
  echo "      (set the pattern to this project's entry name)" >&2
  fail=1
else
  report "initial JS (entry, gz)" "$initial_total" "$BUDGET_INITIAL_JS"
fi

# Every other chunk is lazy-loaded and gets the per-chunk budget.
for f in "$DIST"/assets/*.js; do
  [ -e "$f" ] || continue
  case "$(basename "$f")" in index-*) continue ;; esac
  report "chunk $(basename "$f") (gz)" "$(kb_gz "$f")" "$BUDGET_LAZY_CHUNK"
done

echo
echo "== CSS =="
css_total=0
for f in "$DIST"/assets/*.css; do
  [ -e "$f" ] || continue
  css_total=$(( css_total + $(kb_gz "$f") ))
done
report "total CSS (gz)" "$css_total" "$BUDGET_CSS"

echo
echo "== Images =="
# Source assets and build output both — a large source image that Vite copies
# through unchanged is still shipped.
img_fail=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  report "$f" "$(kb "$f")" "$BUDGET_IMAGE"
  img_fail=1
done <<EOF
$(find $ASSET_DIRS "$DIST" -type f \
    \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' \
       -o -name '*.webp' -o -name '*.avif' -o -name '*.gif' \) \
    -size +"${BUDGET_IMAGE}"k 2>/dev/null)
EOF
[ "$img_fail" -eq 0 ] && echo "ok    no image over ${BUDGET_IMAGE} KB"

echo
echo "== Code splitting =="
# P2: admin and inventory routes must be lazy, or the storefront ships them.
if [ -f src/routes.jsx ]; then
  static_admin=$(grep -nE "^import .*(Admin|Inventory)" src/routes.jsx || true)
  if [ -n "$static_admin" ]; then
    echo "FAIL  admin/inventory statically imported in src/routes.jsx (P2):"
    echo "$static_admin" | sed 's/^/        /'
    fail=1
  else
    echo "ok    admin/inventory routes are lazy"
  fi
else
  echo "skip  src/routes.jsx not found"
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "Budget exceeded. Either fix it, or record the exception in the PR with"
  echo "the number, the reason, and the path back under budget."
  exit 1
fi
echo "All budgets met."
