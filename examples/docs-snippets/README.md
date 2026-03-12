# docs-snippets

Runnable versions of the docs code snippets.

## read-encrypted-return

These snippets are shared by both “decrypt to view” and “decrypt to tx” docs. They show how to read an encrypted return value and derive `{ ctHash, utype }` from the ABI.

- Ethers: `pnpm -C examples/docs-snippets read-encrypted-return:ethers`
- Viem: `pnpm -C examples/docs-snippets read-encrypted-return:viem`

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
SEPOLIA_RPC_URL=https://your-sepolia-rpc pnpm -C examples/docs-snippets read-encrypted-return:viem
```

## remix

Open the `EncryptedCounter` contract directly in Remix (and deploy from there):

- `pnpm -C examples/docs-snippets remix:encrypted-counter`
