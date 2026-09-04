#!/usr/bin/env bash
set -euo pipefail

# The docs build needs no Foundry: @cofhe/mock-contracts and @cofhe/test-setup
# both skip their forge steps when it is absent. This script only guards the
# Node version and delegates to the workspace build.

nodeMajor="$(node -p "parseInt(process.versions.node.split('.')[0], 10)")"
if [ "$nodeMajor" -lt 22 ]; then
  echo "[vercel-build] ERROR: Node >= 22 is required (current: $(node -v))." >&2
  echo "[vercel-build] Fix: set the Vercel Project Node.js Version to 22+." >&2
  exit 1
fi

echo "[vercel-build] Building docs" >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [ ! -f "$REPO_ROOT/package.json" ] || [ ! -f "$REPO_ROOT/pnpm-workspace.yaml" ]; then
  echo "[vercel-build] ERROR: could not resolve repo root from $SCRIPT_DIR" >&2
  exit 1
fi

(cd "$REPO_ROOT" && pnpm build:docs)
