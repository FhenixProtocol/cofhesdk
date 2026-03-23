import { type PublicClient, parseAbi } from 'viem';
import { TASK_MANAGER_ADDRESS } from '../consts.js';

const verifyDecryptResultSafeAbi = parseAbi([
  'function verifyDecryptResultSafe(uint256 ctHash, uint256 result, bytes signature) view returns (bool)',
]);

/**
 * Verifies a decrypt result signature by calling the on-chain
 * `TaskManager.verifyDecryptResultSafe`. The contract recovers the ECDSA signer
 * and compares it against its configured `decryptResultSigner`.
 *
 * Works with both production and mock deployments.
 *
 * @param handle      - The ciphertext handle (ctHash).
 * @param cleartext   - The decrypted plaintext value.
 * @param signature   - The ECDSA signature produced by the threshold network.
 * @param publicClient - A viem PublicClient connected to the target chain.
 * @returns `true` if the on-chain contract confirms the signature is valid, `false` otherwise.
 */
export async function verifyDecryptResult(
  handle: bigint | string,
  cleartext: bigint,
  signature: string,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: TASK_MANAGER_ADDRESS,
    abi: verifyDecryptResultSafeAbi,
    functionName: 'verifyDecryptResultSafe',
    args: [BigInt(handle), cleartext, signature as `0x${string}`],
  });
}
