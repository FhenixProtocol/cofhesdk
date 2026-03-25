import type { PublicClient } from 'viem';
import { TASK_MANAGER_ADDRESS, MOCKS_ZK_VERIFIER_ADDRESS } from '@cofhe/sdk';

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
