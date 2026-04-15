import type { PublicClient } from 'viem';
import { TASK_MANAGER_ADDRESS, MOCKS_ZK_VERIFIER_ADDRESS } from '@cofhe/sdk';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

// ─── Mock contract source discovery ──────────────────────────────────────────

/**
 * Returns Hardhat 3 `npm:` paths for every `.sol` file in
 * `@cofhe/mock-contracts/contracts/`, used to compile the contracts at startup.
 */
export function getMockContractsNpmPaths(): string[] {
  let contractsDir: string;
  try {
    const pkgJson = _require.resolve('@cofhe/mock-contracts/package.json');
    contractsDir = path.join(path.dirname(pkgJson), 'contracts');
  } catch {
    contractsDir = path.join(process.cwd(), 'node_modules', '@cofhe', 'mock-contracts', 'contracts');
  }

  if (!fs.existsSync(contractsDir)) {
    return [];
  }

  return fs
    .readdirSync(contractsDir)
    .filter((f) => f.endsWith('.sol'))
    .map((f) => `npm:@cofhe/mock-contracts/contracts/${f}`);
}

// ─── Mock storage helpers ─────────────────────────────────────────────────────

/**
 * Returns true when mock contracts are deployed (ZkVerifier has code).
 */
async function isMockEnvironment(publicClient: PublicClient): Promise<boolean> {
  const bytecode = await publicClient.getCode({
    address: MOCKS_ZK_VERIFIER_ADDRESS,
  });
  return !!bytecode && bytecode.length > 2;
}

/**
 * Reads the plaintext value stored for a ciphertext hash from MockTaskManager.
 * Returns undefined when not running on a mock network.
 */
export async function mock_getPlaintext(
  publicClient: PublicClient,
  ctHash: bigint | string
): Promise<bigint | undefined> {
  if (!(await isMockEnvironment(publicClient))) {
    console.log('mock_getPlaintext — skipped on non-mock network');
    return undefined;
  }

  return publicClient.readContract({
    address: TASK_MANAGER_ADDRESS,
    abi: [
      {
        name: 'mockStorage',
        type: 'function',
        inputs: [{ name: 'ctHash', type: 'uint256' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'mockStorage',
    args: [BigInt(ctHash)],
  }) as Promise<bigint>;
}

/**
 * Asserts that a ciphertext hash maps to the expected plaintext value.
 */
export async function mock_expectPlaintext(
  publicClient: PublicClient,
  ctHash: bigint | string,
  expectedValue: bigint
): Promise<void> {
  if (!(await isMockEnvironment(publicClient))) {
    console.log('mock_expectPlaintext — skipped on non-mock network');
    return;
  }

  const exists = (await publicClient.readContract({
    address: TASK_MANAGER_ADDRESS,
    abi: [
      {
        name: 'inMockStorage',
        type: 'function',
        inputs: [{ name: 'ctHash', type: 'uint256' }],
        outputs: [{ type: 'bool' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'inMockStorage',
    args: [BigInt(ctHash)],
  })) as boolean;

  if (!exists) throw new Error(`mock_expectPlaintext: ctHash ${ctHash} not found in mock storage`);

  const plaintext = await mock_getPlaintext(publicClient, ctHash);
  if (plaintext !== expectedValue) {
    throw new Error(`mock_expectPlaintext: expected ${expectedValue}, got ${plaintext} for ctHash ${ctHash}`);
  }
}
