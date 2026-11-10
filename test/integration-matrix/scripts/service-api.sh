#!/usr/bin/env bash
# Runs the service API suite against a localcofhe already running on its default ports.
# Needs node, forge and cast on PATH. cofhe's CI runs this inside a throwaway container that
# sees only this checkout, so nothing installed here can reach cofhe's source or credentials.
set -euo pipefail

# The public localcofhe dev key, the default in test/setup/src/env.ts. setup.mjs requires
# TEST_PRIVATE_KEY even when it deploys to localcofhe only.
LOCALCOFHE_DEV_KEY='0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659'
export TEST_PRIVATE_KEY="$LOCALCOFHE_DEV_KEY" TEST_LOCALCOFHE_PRIVATE_KEY="$LOCALCOFHE_DEV_KEY"
export MATRIX_ENV=node MATRIX_CHAIN=localcofhe

# The repo pins pnpm 8 (lockfile v6); another pnpm would reject the lockfile. A shim on PATH,
# because setup.mjs shells out to `pnpm` too.
shim_dir="$(mktemp -d)"
printf '#!/bin/sh\nexec npx --yes pnpm@8.15.6 "$@"\n' > "$shim_dir/pnpm"
chmod +x "$shim_dir/pnpm"
export PATH="$shim_dir:$PATH"

cd "$(dirname "$0")/../../.."
# No dependency install scripts: they are how most npm supply-chain attacks run.
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec turbo run build --filter=@cofhe/integration-matrix^...
(cd test/setup && node setup.mjs --chains 420105)
cd test/integration-matrix
pnpm exec vitest run --project node --reporter=verbose test/serviceApi.test.ts
