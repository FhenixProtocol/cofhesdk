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
const UINT_TYPE_MASK = 0x7fn;
const TYPE_BYTE_OFFSET = 8n;

const getEncryptionTypeFromCtHash = (ctHash: bigint) => Number((ctHash >> TYPE_BYTE_OFFSET) & UINT_TYPE_MASK);

const buildProductionDecryptResultHash = (ctHash: bigint, cleartext: bigint, chainId: number) => {
  const encryptionType = getEncryptionTypeFromCtHash(ctHash);

  return keccak256(
    encodePacked(['uint256', 'uint32', 'uint64', 'uint256'], [cleartext, encryptionType, BigInt(chainId), ctHash])
  );
};

/**
 * Verifies a decrypt result signature **locally** (no `ctHash`/plaintext sent over RPC).
 *
 * The recovered signer must equal the on-chain configured `decryptResultSigner`.
 *
 * This mirrors the TaskManager decrypt-result hash format:
 * `keccak256(abi.encodePacked(result, encType, chainId, ctHash))`
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
  const chainId = publicClient.chain?.id ?? (await publicClient.getChainId());
  const expectedSigner = await publicClient.readContract({
    address: TASK_MANAGER_ADDRESS,
    abi: decryptResultSignerAbi,
    functionName: 'decryptResultSigner',
    args: [],
  });

  if (isAddressEqual(expectedSigner, zeroAddress)) return true;

  const ctHash = BigInt(handle);
  const messageHash = buildProductionDecryptResultHash(ctHash, cleartext, chainId);

  try {
    const recovered = await recoverAddress({ hash: messageHash, signature });
    return isAddressEqual(recovered, expectedSigner);
  } catch {
    return false;
  }
}
