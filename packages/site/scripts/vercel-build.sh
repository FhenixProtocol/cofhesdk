#!/usr/bin/env bash
set -euo pipefail

# Vercel doesn't ship with Foundry (forge) in its default build image.
# This script installs it (if missing) and then builds the docs.

nodeMajor="$(node -p "parseInt(process.versions.node.split('.')[0], 10)")"
if [ "$nodeMajor" -lt 22 ]; then
  echo "[vercel-build] ERROR: Node >= 22 is required (current: $(node -v))." >&2
  echo "[vercel-build] Fix: set the Vercel Project Node.js Version to 22+." >&2
  exit 1
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "[vercel-build] Installing Foundry (forge)" >&2
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
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
