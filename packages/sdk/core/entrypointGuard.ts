import { CofheError, CofheErrorCode } from './error.js';

/**
 * The type of the stubs' only parameter. No config is assignable to it, so the compiler reports
 * this sentence at the call site.
 */
type ImportFromPlatformEntrypoint<Name extends string> =
  `'${Name}' is not available from '@cofhe/sdk'. Import it from '@cofhe/sdk/node' (Node.js, Hardhat, scripts) or '@cofhe/sdk/web' (browser).`;

const wrongEntrypoint = (name: string): never => {
  throw new CofheError({
    code: CofheErrorCode.WrongEntrypoint,
    message: `'${name}' is not available from '@cofhe/sdk'.`,
    hint: `Import ${name} from '@cofhe/sdk/node' (Node.js, Hardhat, scripts) or '@cofhe/sdk/web' (browser). Types, Encryptable, FheTypes and CofheError stay on '@cofhe/sdk'.`,
    context: { name },
  });
};

// `@cofhe/sdk` loads no WASM: the TFHE module differs between Node.js and the browser and must
// only be imported in its own runtime. These two names exist here so that the import most people
// (and coding agents) try first fails with the fix instead of "has no exported member".

/**
 * Not available from `@cofhe/sdk`: import `createCofheClient` from `@cofhe/sdk/node` (Node.js,
 * Hardhat, scripts) or `@cofhe/sdk/web` (browser). Calling this one throws `WRONG_ENTRYPOINT`.
 */
export function createCofheClient(_importFromNodeOrWeb: ImportFromPlatformEntrypoint<'createCofheClient'>): never {
  return wrongEntrypoint('createCofheClient');
}

/**
 * Not available from `@cofhe/sdk`: import `createCofheConfig` from `@cofhe/sdk/node` (Node.js,
 * Hardhat, scripts) or `@cofhe/sdk/web` (browser). Calling this one throws `WRONG_ENTRYPOINT`.
 */
export function createCofheConfig(_importFromNodeOrWeb: ImportFromPlatformEntrypoint<'createCofheConfig'>): never {
  return wrongEntrypoint('createCofheConfig');
}
