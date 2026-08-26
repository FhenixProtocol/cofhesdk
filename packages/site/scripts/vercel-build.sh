#!/usr/bin/env bash
set -euo pipefail

# Vercel doesn't ship with Foundry (forge) in its default build image.
# This script installs it (if missing) and then builds the docs.

# Pinned on purpose. foundryup resolves "latest" on every build, so the docs
# deploy silently depended on whatever Foundry shipped that morning. Bump this
# deliberately, not by accident.
FOUNDRY_VERSION="${FOUNDRY_VERSION:-v1.7.1}"

nodeMajor="$(node -p "parseInt(process.versions.node.split('.')[0], 10)")"
if [ "$nodeMajor" -lt 22 ]; then
  echo "[vercel-build] ERROR: Node >= 22 is required (current: $(node -v))." >&2
  echo "[vercel-build] Fix: set the Vercel Project Node.js Version to 22+." >&2
  exit 1
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "[vercel-build] Installing Foundry $FOUNDRY_VERSION (forge only)" >&2

  # Deliberately not foundryup. After downloading, foundryup verifies every
  # binary in the toolchain by running `<bin> -V`, and `anvil -V` exits 1 in
  # Vercel's build sandbox — which failed the whole docs deploy even though
  # nothing here ever runs anvil. The only Foundry binary this build needs is
  # forge (@cofhe/mock-contracts' build-artifacts shells out to `forge inspect`),
  # so fetch the release tarball and extract that one file. This also drops
  # foundryup's attestation step, which needs the bash process substitution the
  # sandbox doesn't provide — previously worked around with `--force`.
  base="https://github.com/foundry-rs/foundry/releases/download/${FOUNDRY_VERSION}"
  archive="foundry_${FOUNDRY_VERSION}_linux_amd64.tar.gz"
  # The checksum asset replaces the .tar.gz suffix rather than appending to it.
  checksum="${archive%.tar.gz}.sha256"

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  curl -fsSL "$base/$archive" -o "$tmp/$archive"

  # `--force` used to skip foundryup's SHA step, which left a truncated or
  # corrupted download undetectable. Check it ourselves instead: the release
  # publishes a .sha256 next to the archive.
  expected="$(curl -fsSL "$base/$checksum" | awk '{print $1}')"
  actual="$(sha256sum "$tmp/$archive" | awk '{print $1}')"
  if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
    echo "[vercel-build] ERROR: Foundry checksum mismatch for $archive." >&2
    echo "[vercel-build]   expected: ${expected:-<none published>}" >&2
    echo "[vercel-build]   actual:   $actual" >&2
    exit 1
  fi

  mkdir -p "$HOME/.foundry/bin"
  tar -xzf "$tmp/$archive" -C "$HOME/.foundry/bin" forge
  export PATH="$HOME/.foundry/bin:$PATH"

  echo "[vercel-build] $(forge --version | head -1)" >&2
else
  echo "[vercel-build] Foundry already available" >&2
fi

# Ensure foundry-installed binaries are visible even if already present.
export PATH="$HOME/.foundry/bin:$PATH"

echo "[vercel-build] Building docs" >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [ ! -f "$REPO_ROOT/package.json" ] || [ ! -f "$REPO_ROOT/pnpm-workspace.yaml" ]; then
  echo "[vercel-build] ERROR: could not resolve repo root from $SCRIPT_DIR" >&2
  exit 1
fi

(cd "$REPO_ROOT" && pnpm build:docs)
