# docs-snippets

Runnable versions of the docs code snippets.

## decrypt-to-view

- Ethers: `pnpm -C examples/docs-snippets decrypt-to-view:ethers`
- Viem: `pnpm -C examples/docs-snippets decrypt-to-view:viem`

### RPC configuration

These scripts automatically load environment variables from the repo root `.env` if it exists.

By default (if no env var is set), both scripts use `https://rpc.sepolia.org`.

To override, set one of:

- `SEPOLIA_RPC_URL`
- `RPC_URL`

Optional:

- `RPC_TIMEOUT_MS` (default: `30000`)

Example:

```bash
SEPOLIA_RPC_URL=https://your-sepolia-rpc pnpm -C examples/docs-snippets decrypt-to-view:viem
```
