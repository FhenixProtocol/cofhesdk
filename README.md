# cofhesdk

This repo contains the full toolkit for interacting with Fhenix's CoFHE coprocessor.
The repo is split into the following packages

- `@cofhesdk/adapters` Adapters which convert various providers and signers into a standardized format for use within cofhesdk.
- `@cofhesdk/permits` Create, share, and manage CoFHE permits, which are used to authenticate accounts during decryption.
- `@cofhesdk/core` Fetches FHE keys, encrypts inputs, decrypts handles.
- `@cofhesdk/web` Wrapper around `/core` with web specific logic injected (web tfhe, localstorage / indexdb, etc)
- `@cofhesdk/node` Wrapper around `/core` with node specific logic (node tfhe, filesystem storage, etc)
- `@cofhesdk/react` Package including react hooks and pre-built components for easy development
- `@cofhesdk/mock-contracts` Mock contracts replicating the off-chain CoFHE functionality, but on chain. Used by hh-plugin
- `@cofhesdk/hh-plugin` Configures hardhat, deploys mock contracts, exposes utility functions for better testing
