/**
 * CREATE2 deployment of the test contracts, shared by setup.mjs (deploys and skips), tsup.config.ts
 * (inlines the address into the bundle) and the test suites.
 *
 * The address depends only on the deployer, the salt and the creation bytecode, so every party
 * computes the same one from the forge artifact and nothing has to be stored or kept in sync.
 */

import { readFileSync } from 'node:fs';
import { getContractAddress, keccak256, stringToHex } from 'viem';

/** Deterministic deployment proxy, at the same address on every chain it was deployed to. */
export const CREATE2_DEPLOYER = '0x4e59b44847b379578588920cA78FbF26c0B4956C';

/** Fixed per contract, so the address moves only when the bytecode does. */
export const create2Salt = (contractName) => keccak256(stringToHex(`@cofhe/test-setup ${contractName}`));

/** Creation bytecode from a forge artifact (`out/<Name>.sol/<Name>.json`). */
export function readCreationBytecode(artifactPath) {
  return JSON.parse(readFileSync(artifactPath, 'utf8')).bytecode.object;
}

export function create2Address(contractName, creationBytecode) {
  return getContractAddress({
    opcode: 'CREATE2',
    from: CREATE2_DEPLOYER,
    salt: create2Salt(contractName),
    bytecode: creationBytecode,
  });
}
