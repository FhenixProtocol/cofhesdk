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

export function createFoundryArtifactReader() {
  const outDir = resolveMockContractsOutDir();

  return {
    async readArtifact(contractName: string) {
      const artifactPath = resolve(outDir, `${contractName}.sol`, `${contractName}.json`);
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
