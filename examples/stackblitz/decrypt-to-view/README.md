# CoFHE `decryptForView` (StackBlitz)

Minimal browser demo that:

1) Creates a CoFHE client (`@cofhe/sdk/web`)
2) Reads the encrypted counter handle from Sepolia
3) Creates/selects a self permit
4) Decrypts via `decryptForView`

## Setup

- Copy `.env.example` to `.env`
- Set `VITE_TEST_PRIVATE_KEY` (use a throwaway key)
- Optional: set `VITE_SEPOLIA_RPC_URL`

## Run

- `npm install`
- `npm run dev`

This targets the predeployed contract by default:
`0xbD0C2095d3C10782369547fd4C1644fEC7A82d36`
