import type { PublicClient } from 'viem';
import { getContract } from 'viem';
import type { MockArtifact } from '@cofhe/mock-contracts';
import {
  MockTaskManagerArtifact,
  MockACLArtifact,
  MockThresholdNetworkArtifact,
  MockZkVerifierArtifact,
  TestBedArtifact,
} from '@cofhe/mock-contracts';
import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
} from '@cofhe/sdk';

// ─── Contract accessors ───────────────────────────────────────────────────────

/**
 * Returns a viem contract instance for a fixed-address mock artifact.
 * Throws if the artifact is not fixed (i.e. has no known address).
 */
export function getFixedMockContract(
  publicClient: PublicClient,
  artifact: MockArtifact & { isFixed: true },
) {
  return getContract({
    address: artifact.fixedAddress as `0x${string}`,
    abi: artifact.abi,
    client: publicClient,
  });
}

/** Returns a viem contract bound to the MockTaskManager fixed address. */
export function getMockTaskManagerContract(publicClient: PublicClient) {
  return getFixedMockContract(publicClient, MockTaskManagerArtifact);
}

/** Returns a viem contract bound to the MockZkVerifier fixed address. */
export function getMockZkVerifierContract(publicClient: PublicClient) {
  return getFixedMockContract(publicClient, MockZkVerifierArtifact);
}

/** Returns a viem contract bound to the MockThresholdNetwork fixed address. */
export function getMockThresholdNetworkContract(publicClient: PublicClient) {
  return getFixedMockContract(publicClient, MockThresholdNetworkArtifact);
}

/** Returns a viem contract bound to the TestBed fixed address. */
export function getTestBedContract(publicClient: PublicClient) {
  return getFixedMockContract(publicClient, TestBedArtifact);
}

/**
 * Returns a viem contract bound to MockACL.
 * The address is read from the TaskManager's `acl()` getter since ACL is
 * deployed to a non-deterministic address (constructor initialises EIP-712).
 */
export async function getMockACLContract(publicClient: PublicClient) {
  const aclAddress = await publicClient.readContract({
    address: TASK_MANAGER_ADDRESS,
    abi: [{ name: 'acl', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
    functionName: 'acl',
  });

  return getContract({
    address: aclAddress,
    abi: MockACLArtifact.abi,
    client: publicClient,
  });
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
  ctHash: bigint | string,
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
  expectedValue: bigint,
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
    throw new Error(
      `mock_expectPlaintext: expected ${expectedValue}, got ${plaintext} for ctHash ${ctHash}`,
    );
  }
}
