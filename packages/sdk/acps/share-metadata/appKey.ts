import { keccak256, stringToHex, type Hex } from 'viem';

/**
 * The key an app marks its shares with: keccak256 of its name, e.g. `shareAppKey('explorer.fhenix.io')`.
 * A client configured with `acp: { app }` puts it on every share it creates and lists only the
 * shares that carry it; the name itself is never on-chain.
 */
export const shareAppKey = (app: string): Hex => keccak256(stringToHex(app));
