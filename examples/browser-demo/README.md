# @cofhe/browser-demo

Tiny browser app (Vite) that uses `@cofhe/sdk/web` with `prompt()`/`alert()` to:

- Encrypt a `uint32` in the browser
- Submit it to a Sepolia contract as `InEuint32`
- Read the encrypted handle (`euint32`) back
- Decrypt locally via permits

## Run

From the repo root:

```bash
pnpm -C examples/browser-demo dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Contract

This demo expects a contract with:

- `function setValue(InEuint32 inValue) external`
- `function getValue() external view returns (euint32)`

The docs page `/browser-demo` shows a Remix-ready contract you can deploy on Sepolia.
