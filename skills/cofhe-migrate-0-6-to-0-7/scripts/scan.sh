#!/usr/bin/env bash
# Read-only survey of a codebase for @cofhe/* 0.6.x -> 0.7.0 migration work.
# Writes nothing. Usage: ./scan.sh [path]   (default: current directory)

set -uo pipefail
ROOT="${1:-.}"

TS=(--include=*.ts --include=*.tsx)
SOL=(--include=*.sol)
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build
          --exclude-dir=.git --exclude-dir=out --exclude-dir=cache
          --exclude-dir=typechain-types --exclude-dir=artifacts)

section() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

# hits <pattern> <file-globs...> - print matches, or "none"
hits() {
  local pattern="$1"; shift
  local out
  out=$(grep -rnE "$pattern" "${EXCLUDES[@]}" "$@" "$ROOT" 2>/dev/null)
  if [ -z "$out" ]; then echo "  none"; else echo "$out" | sed 's/^/  /'; fi
}

section "Installed @cofhe/* versions"
grep -rhoE '"@cofhe/[a-z0-9-]+"[[:space:]]*:[[:space:]]*"[^"]+"' \
  --include=package.json "${EXCLUDES[@]}" "$ROOT" 2>/dev/null | sort -u | sed 's/^/  /' || echo "  none"
grep -rhoE '"@fhenixprotocol/cofhe-contracts"[[:space:]]*:[[:space:]]*"[^"]+"' \
  --include=package.json "${EXCLUDES[@]}" "$ROOT" 2>/dev/null | sort -u | sed 's/^/  /'

section "CONTRACTS - deleted InEuintXX structs (Case A: must change + redeploy)"
hits '\bIn(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)\b' "${SOL[@]}"

section "CONTRACTS - already on external* (count encrypted params: 1 = no change, 2+ = Case C)"
hits '\bexternal(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)\b' "${SOL[@]}"

section "CONTRACTS - cross-contract encrypted values -> sharedEuintXX (compiler will NOT catch these)"
hits '\ballowTransient\b' "${SOL[@]}"

section "CONTRACTS - non-view functions returning an encrypted value (Case S2)"
grep -rnE 'returns\s*\([^)]*\b(euint(8|16|32|64|128)|ebool|eaddress)\b' \
  "${EXCLUDES[@]}" "${SOL[@]}" "$ROOT" 2>/dev/null \
  | grep -vE '\bview\b|\bpure\b' | sed 's/^/  /' || echo "  none"

section "FOUNDRY - removed helpers"
hits 'createIn(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)|_asHashPlusProof|zkVerifySign(Packed)?|createEncryptedInput\b|createBasePermission' "${SOL[@]}"

section "SDK - encrypt call sites (each needs setConsumingContract + new return shape)"
hits '\.encryptInputs\(|asHashPlusProof' "${TS[@]}"

section "SDK - removed encrypted-input types"
hits 'EncryptedItemInput|Encrypted(Bool|Uint8|Uint16|Uint32|Uint64|Uint128|Address)Input|assertCorrectEncryptedItemInput' "${TS[@]}"

# Split by kind so no single list dominates, and so a cap (if any) is obvious rather than silent.
# 'Permit' is deliberately unanchored: identifiers embed it mid-word (SerializedPermit,
# useCofheCreatePermit), so \bPermit would miss almost everything. Lowercase 'permit' IS
# anchored, to keep 'permitted'/'permitting' out.
PERMIT_NOISE='permitted|permitting|permissible|isPermittedCofheEnvironment|isAllowedWithPermission|Permitted'

section "SDK - Permit -> ACP :: client namespace and builders"
hits 'client\.permits|\.withPermit\(|\.withoutPermit\(|setPermitHash|PermitUtils' "${TS[@]}"

section "SDK - Permit -> ACP :: imports and type names"
hits "from ['\"]@cofhe/sdk/permits|\\bSerializedPermit\\b|\\bPermitState\\b|\\bPermitOptions\\b" "${TS[@]}"

section "SDK - Permit -> ACP :: everything else mentioning permit (verify each traces to a @cofhe/* import)"
# Deliberately uncapped - this section under-reporting is worse than it being long.
permit_all=$(grep -rnE 'Permit|\bpermits?\b' "${EXCLUDES[@]}" "${TS[@]}" "$ROOT" 2>/dev/null \
  | grep -vE "$PERMIT_NOISE")
if [ -z "$permit_all" ]; then
  echo "  none"
else
  echo "$permit_all" | sed 's/^/  /'
  echo "  ---"
  echo "  $(printf '%s\n' "$permit_all" | wc -l | tr -d ' ') total hits (uncapped)"
fi

section "SDK - Permit -> ACP :: prefix and value compares (no import to grep for)"
hits "startsWith\\(['\"]permit|includes\\(['\"]permit|=== ['\"]permit|body\\.permit|['\"]permit['\"][[:space:]]*:" "${TS[@]}"

section "REACT - old status-id / intent string VALUES (member access is compiler-caught, values are not)"
hits "'(open-permits|missing-permit|permit-expired|permit-expiring-soon|permit-shared)'" "${TS[@]}"

section "CONFIG - renamed keys (silently ignored in 0.6.x, now throw)"
hits 'defaultPermitExpiration|shareablePermits|autogeneratePermits|permitExpirationOptions|defaultPermitExpirationSeconds' "${TS[@]}"

section "REACT - renamed hooks, components, and types"
hits 'useCofhe(Permits|ActivePermit|AllPermits|RemovePermit|SelectPermit|CreatePermit|NavigateToCreatePermit)|useWatchPermitStatus|\bPermitState\b|Permit(Card|Item|InfoModal|DetailsModal|TypeInfoModal)' "${TS[@]}"

section "REACT - renamed hook options/returned fields (destructuring these silently yields undefined)"
hits 'requiresPermit|disabledDueToMissing[A-Za-z]*Permit|hasActivePermit|activePermitHash' "${TS[@]}"

section "REACT - bare-array useCofheEncrypt calls (removed form)"
hits 'encrypt(InputsAsync)?\(\s*\[' "${TS[@]}"

section "ERRORS - renamed codes and stale string comparisons"
hits "CofheErrorCode\.(Permit|InvalidPermit|CannotRemoveLastPermit)|'PERMIT_[A-Z_]+'|\"PERMIT_[A-Z_]+\"|permit_(malformed|denied|expired|invalid|required|verifier)" "${TS[@]}"

printf '\n\033[1m== Done\033[0m\n'
echo "  Read-only. See references/ for what to do with each section."
