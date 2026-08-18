#!/usr/bin/env bash
# Mechanical audit pass. Copy nowhere — run it from the repo root:
#
#   bash .agents/skills/audit-and-review/assets/audit_scan.sh
#   bash .agents/skills/audit-and-review/assets/audit_scan.sh security
#
# EVERY HIT IS A CANDIDATE, NOT A FINDING. Roughly half are false positives —
# a viewset with no permission_classes may be read-only; a hex literal may be
# in a token file. Open the file before reporting anything.
#
# What this cannot see is listed at the end, and in references/01-check-catalogue.md.
# Treating a clean run as "no problems" is the main way to misuse this script.

set -uo pipefail

SCOPE="${1:-full}"
BACKEND="${BACKEND:-daf_backend}"
FRONTEND="${FRONTEND:-daf front/daf frontend}"

candidates=0

section() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# check <id> <description> <command>
# The command prints candidate lines. Empty output = clean.
check() {
  local id="$1" desc="$2" cmd="$3"
  local out
  out=$(eval "$cmd" 2>/dev/null || true)
  if [ -n "$out" ]; then
    printf '\n\033[31m[%s]\033[0m %s\n' "$id" "$desc"
    printf '%s\n' "$out" | sed 's/^/    /' | head -20
    local n; n=$(printf '%s\n' "$out" | wc -l)
    [ "$n" -gt 20 ] && printf '    ... and %d more\n' "$((n - 20))"
    candidates=$((candidates + 1))
  else
    printf '  ok  %-6s %s\n' "$id" "$desc"
  fi
}

# =============================================================================
if [ "$SCOPE" = "full" ] || [ "$SCOPE" = "security" ]; then
section "Security"

check "S1/S2" "ViewSet with no explicit permission_classes" \
  "for f in \$(grep -rl 'class .*ViewSet' --include=views.py '$BACKEND' 2>/dev/null); do
     grep -q 'permission_classes' \"\$f\" || echo \"\$f\"
   done"

check "S1" "AllowAny on a ModelViewSet (writes included)" \
  "grep -rn 'AllowAny' --include=views.py '$BACKEND' 2>/dev/null"

check "S6" "Permission class returning an unconditional True" \
  "grep -rn -A3 'def has_permission' --include=permissions.py '$BACKEND' 2>/dev/null \
     | grep -B1 'return True' | grep 'def has_permission'"

check "S5" "Client-supplied price, amount or total read from the request" \
  "grep -rnE \"(request\\.)?data(\\.get\\(|\\[)['\\\"](price|amount|total|total_amount|unit_price|discount)\" \
     --include=*.py '$BACKEND' 2>/dev/null"

check "S5" "Client-supplied transaction id trusted" \
  "grep -rnE \"data(\\.get\\(|\\[)['\\\"](transaction_id|trxID|payment_status)\" \
     --include=*.py '$BACKEND' 2>/dev/null"

check "S3" "Credential-shaped literal in source" \
  "grep -rnE \"['\\\"]?(PASSWORD|SECRET_KEY|API_KEY|SECRET|APP_SECRET|TOKEN)['\\\"]?\\s*[:=]\\s*['\\\"][^'\\\"]{8,}\" \
     --include=*.py '$BACKEND' 2>/dev/null \
     | grep -v 'os.environ\\|env(\\|AUTH_PASSWORD_VALIDATORS\\|VALIDATOR'"

check "S3" "Database, log or .env file tracked in git" \
  "{ git ls-files 2>/dev/null; git submodule --quiet foreach 'git ls-files | sed \"s|^|\$sm_path/|\"' 2>/dev/null; } \
     | grep -E '\\.sqlite3\$|\\.log\$|^\\.env\$|/\\.env\$'"

check "S4" "DEBUG hardcoded, or read without a False default" \
  "grep -rnE '^DEBUG\\s*=\\s*(True|bool\\()' --include=settings*.py '$BACKEND' 2>/dev/null"

check "S4" "SECURE_* block absent" \
  "grep -rq 'SECURE_SSL_REDIRECT' --include=settings*.py '$BACKEND' 2>/dev/null \
     || echo 'No SECURE_SSL_REDIRECT anywhere in settings'"

check "S7/S8" "Role read from localStorage" \
  "grep -rnE \"localStorage.*is_staff|is_staff.*localStorage|JSON.parse\\(localStorage\" \
     '$FRONTEND/src' 2>/dev/null"

check "S8" "Role check inside a layout component instead of the route" \
  "grep -rnE 'is_staff|isAdmin|is_superuser' '$FRONTEND/src' 2>/dev/null \
     | grep -iE 'Layout|Dashboard'"

check "N2" "No DRF throttle configuration" \
  "grep -rq 'DEFAULT_THROTTLE_RATES' --include=settings*.py '$BACKEND' 2>/dev/null \
     || echo 'No DEFAULT_THROTTLE_RATES — a 6-digit OTP is ~10^6 guesses'"

check "N2" "LocMemCache in production config (per-process throttle counters)" \
  "grep -rn 'locmem' --include=settings*.py '$BACKEND' 2>/dev/null"

check "N3" "OTP stored as a plain field on the user row" \
  "grep -rnE 'otp\\s*=\\s*models\\.(Char|Integer)Field' --include=models.py '$BACKEND' 2>/dev/null"

check "N5" "FileField/ImageField with no validators" \
  "grep -rn -E '(File|Image)Field\\(' --include=models.py '$BACKEND' 2>/dev/null \
     | grep -v 'validators'"

check "N11" "AllowAny detail route with a raw pk lookup (enumeration)" \
  "grep -rn -B4 'objects.get(pk=' --include=views.py '$BACKEND' 2>/dev/null \
     | grep 'AllowAny'"

check "N12" "Writable timestamp field (backdating)" \
  "grep -rnE \"fields.*['\\\"]created_at\" --include=serializers.py '$BACKEND' 2>/dev/null \
     | grep -v read_only"
fi

# =============================================================================
if [ "$SCOPE" = "full" ] || [ "$SCOPE" = "correctness" ]; then
section "Correctness"

check "C1" "env var name looks like a pasted value" \
  "grep -rnE \"environ\\.get\\(['\\\"][^A-Z'\\\"]\" --include=*.py '$BACKEND' 2>/dev/null"

check "C1" "Integration guarded by a truthiness check that silently skips" \
  "grep -rnE 'if (settings\\.|getattr\\(settings)[^:]*(API_KEY|SECRET|TOKEN)' \
     --include=*.py '$BACKEND' 2>/dev/null"

check "C2" "TIME_ZONE is not Asia/Dhaka" \
  "grep -rn \"TIME_ZONE\" --include=settings*.py '$BACKEND' 2>/dev/null | grep -v 'Asia/Dhaka'"

check "C2" "date.today() instead of timezone.localdate()" \
  "grep -rn 'date.today()\\|datetime.now()' --include=*.py '$BACKEND' 2>/dev/null"

check "C3" "Blocking third-party call in a view or signal" \
  "grep -rnE 'send_mail|EmailMessage|requests\\.(get|post)' \
     --include=views.py --include=signals.py '$BACKEND' 2>/dev/null"

check "C3" "threading used for background work" \
  "grep -rn 'threading.Thread\\|Thread(' --include=*.py '$BACKEND' 2>/dev/null"

check "C5" "Behaviour driven by a private instance attribute" \
  "grep -rnE \"getattr\\((instance|obj), ['\\\"]_\" --include=*.py '$BACKEND' 2>/dev/null"

check "—" "Multi-row write with no transaction.atomic" \
  "for f in \$(grep -rl 'bulk_create\\|objects.create' --include=views.py '$BACKEND' 2>/dev/null); do
     grep -q 'atomic' \"\$f\" || echo \"\$f\"
   done"

check "N10" "Order creation with no idempotency key" \
  "grep -rq 'idempotency' --include=*.py '$BACKEND' 2>/dev/null \
     || echo 'No idempotency key anywhere — a double submit creates two orders'"

check "—" "Mutation inside a shallow-copied array (breaks React.memo)" \
  "grep -rnE '\\[\\.\\.\\..*\\][^;]*;[^;]*\\[[a-zA-Z]+\\]\\.[a-zA-Z]+\\s*(\\+=|=)' \
     '$FRONTEND/src' 2>/dev/null"

check "—" "Full page reload used as SPA navigation" \
  "grep -rn 'window.location.href' '$FRONTEND/src' 2>/dev/null"

check "—" "Global window.__ config" \
  "grep -rn 'window.__' '$FRONTEND/src' 2>/dev/null"
fi

# =============================================================================
if [ "$SCOPE" = "full" ] || [ "$SCOPE" = "performance" ]; then
section "Performance"

check "P4" "Nested serializer with no prefetch on the viewset queryset" \
  "for f in \$(grep -rl 'many=True' --include=serializers.py '$BACKEND' 2>/dev/null); do
     v=\"\$(dirname \"\$f\")/views.py\"
     [ -f \"\$v\" ] && ! grep -q 'prefetch_related\\|select_related' \"\$v\" && echo \"\$v\"
   done"

check "P4" "Over-serialisation via __all__" \
  "grep -rn \"fields = '__all__'\" --include=serializers.py '$BACKEND' 2>/dev/null"

check "P1" "No pagination configured" \
  "grep -rq 'DEFAULT_PAGINATION_CLASS' --include=settings*.py '$BACKEND' 2>/dev/null \
     || echo 'No DEFAULT_PAGINATION_CLASS — list endpoints have no ceiling'"

check "P1" "Client-side filtering of a fetched list" \
  "grep -rnE '\\.filter\\(.*(search|query|category|brand)' \
     '$FRONTEND/src/context' '$FRONTEND/src/pages' 2>/dev/null"

check "P2" "Admin or inventory route statically imported" \
  "grep -rnE '^import .*(Admin|Inventory)' '$FRONTEND/src/routes.jsx' 2>/dev/null"

check "P3" "Asset over 300 KB" \
  "find '$FRONTEND/src/assets' '$FRONTEND/public' -type f -size +300k 2>/dev/null"

check "—" "Namespace icon import (ships the whole set)" \
  "grep -rn \"import \\* as .* from 'lucide-react'\\|from 'react-icons'\" \
     '$FRONTEND/src' 2>/dev/null"

check "—" "More than one toast library" \
  "grep -cE 'sonner|react-hot-toast|react-toastify' '$FRONTEND/package.json' 2>/dev/null \
     | awk '\$1 > 1 {print \"package.json declares \" \$1 \" toast libraries\"}'"
fi

# =============================================================================
if [ "$SCOPE" = "full" ]; then
section "Structural"

check "§2.5" "Serializer field with no matching model field (drift)" \
  "echo 'MANUAL: run the drift detector in api-contract/01-drift-detection.md'"

check "—" "No security regression suite" \
  "[ -f '$BACKEND/tests/test_security_regressions.py' ] \
     || echo 'tests/test_security_regressions.py is absent — nothing pins S1-S8'"

check "—" "No pre-commit config" \
  "[ -f .pre-commit-config.yaml ] || echo 'No .pre-commit-config.yaml — nothing scans for secrets locally'"

check "—" "No CI workflow" \
  "[ -d .github/workflows ] || echo 'No CI — every gate is manual'"

check "—" "CI gate that cannot fail" \
  "grep -rn 'continue-on-error\\|| true' .github/workflows/ 2>/dev/null"
fi

# =============================================================================
printf '\n'
if [ "$candidates" -eq 0 ]; then
  printf '\033[32mNo candidates from the mechanical pass.\033[0m\n'
else
  printf '\033[31m%d check(s) produced candidates.\033[0m\n' "$candidates"
fi

cat <<'EOF'

CANDIDATES, NOT FINDINGS. Open each file before reporting it — roughly half of
these are false positives.

This scan CANNOT see:
  - a permission class that exists and does nothing (S6 was a real class with a
    real name that returned True)
  - a serializer field with no model behind it (§2.5 — needs the drift detector)
  - whether a recomputed total is recomputed CORRECTLY
  - business-logic errors of any kind
  - race conditions, or anything needing runtime observation
  - whether the tests that exist actually assert anything

A clean run means the mechanical checks passed. It does not mean the codebase
is safe. See references/01-check-catalogue.md for the manual pass.
EOF

exit 0
