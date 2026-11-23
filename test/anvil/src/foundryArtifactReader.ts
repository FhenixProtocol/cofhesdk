/**
 * Creates a minimal artifact reader that satisfies the `ArtifactManager.readArtifact`
 * interface expected by `@cofhe/hardhat-3-plugin`'s `deployMocks`, reading from
 * Foundry's compiled output in `@cofhe/mock-contracts/out/`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

function resolveMockContractsOutDir(): string {
  const require = createRequire(import.meta.url);
  const mockPkgJson = require.resolve('@cofhe/mock-contracts/package.json');
  return resolve(mockPkgJson, '..', 'out');
}

/** Contracts whose source file name differs from the contract name. */
const CONTRACT_SOURCE_FILES: Record<string, string> = {
  MockACP: 'ACP.sol',
};

export function createFoundryArtifactReader() {
  const outDir = resolveMockContractsOutDir();

  return {
    async readArtifact(contractName: string) {
      const sourceFile = CONTRACT_SOURCE_FILES[contractName] ?? `${contractName}.sol`;
      const artifactPath = resolve(outDir, sourceFile, `${contractName}.json`);
      const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
      return {
        contractName,
        abi: artifact.abi,
        bytecode: artifact.bytecode.object as string,
        deployedBytecode: artifact.deployedBytecode.object as string,
      };
    },
  };
}
