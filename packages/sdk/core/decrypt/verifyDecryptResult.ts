import {
  encodePacked,
  isAddressEqual,
  keccak256,
  parseAbi,
  recoverAddress,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { TASK_MANAGER_ADDRESS } from '../consts.js';

const decryptResultSignerAbi = parseAbi(['function decryptResultSigner() view returns (address)']);

/**
 * Verifies a decrypt result signature **locally** (no `ctHash`/plaintext sent over RPC).
 *
 * This matches the TaskManager contract logic:
 *   - messageHash = keccak256(abi.encodePacked(ctHash, result))
 *   - recovered = ecrecover(messageHash, signature)
 *   - recovered must equal the on-chain configured `decryptResultSigner`
 *
 * The only on-chain read performed is `TaskManager.decryptResultSigner()` (via `eth_call`).
 *
 * Works with both production and mock deployments.
 */
export async function verifyDecryptResult(
  handle: bigint | string,
  cleartext: bigint,
  signature: Hex,
  publicClient: PublicClient
): Promise<boolean> {
  const expectedSigner = await publicClient.readContract({
    address: TASK_MANAGER_ADDRESS,
    abi: decryptResultSignerAbi,
    functionName: 'decryptResultSigner',
    args: [],
  });

  if (isAddressEqual(expectedSigner, zeroAddress)) return true;

  const ctHash = BigInt(handle);
  const messageHash = keccak256(encodePacked(['uint256', 'uint256'], [ctHash, cleartext]));

  try {
    const recovered = await recoverAddress({ hash: messageHash, signature });
    return isAddressEqual(recovered, expectedSigner);
  } catch {
    return false;
  }
}
