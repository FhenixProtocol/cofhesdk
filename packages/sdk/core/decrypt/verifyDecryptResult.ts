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
import { getTaskManagerAddress } from '../taskManager.js';

const decryptResultSignerAbi = parseAbi(['function decryptResultSigner() view returns (address)']);
const UINT_TYPE_MASK = 0x7fn;
const TYPE_BYTE_OFFSET = 8n;

// Upper bound for s in OpenZeppelin's ECDSA.tryRecover (secp256k1 order / 2).
const SECP256K1_HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;

// The TaskManager checks decrypt result signatures with ECDSA.tryRecover, which only accepts
// 65 bytes (r, s, v) with v = 27 or 28 and s in the lower half of the curve order.
const isAcceptedByTaskManager = (signature: Hex) => {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return false;
  const s = BigInt(`0x${signature.slice(66, 130)}`);
  const v = parseInt(signature.slice(130), 16);
  return (v === 27 || v === 28) && s <= SECP256K1_HALF_N;
};

const getEncryptionTypeFromCtHash = (ctHash: bigint) => Number((ctHash >> TYPE_BYTE_OFFSET) & UINT_TYPE_MASK);

const buildDecryptResultHash = (ctHash: bigint, cleartext: bigint, chainId: number) => {
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
 * The signature must also be in the form the TaskManager accepts: 65 bytes with v = 27 or 28 and a
 * low s value. Other encodings of a valid signature (v = 0 or 1, high s) return `false`, because
 * `verifyDecryptResult` / `publishDecryptResult` on-chain revert with `InvalidSignature` for them.
 *
 * Fails closed: if the chain has no `decryptResultSigner` set (zero address), this returns `false`.
 * The on-chain `verifyDecryptResult` instead accepts any signature in that case.
 *
 * This mirrors the TaskManager decrypt-result hash format:
 * `keccak256(abi.encodePacked(result, encType, chainId, ctHash))`
 *
 * The only on-chain reads performed are the Task Manager lookup in the CoFHEAddressBook (cached
 * per chain) and `TaskManager.decryptResultSigner()` (via `eth_call`).
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
    address: await getTaskManagerAddress(publicClient, chainId),
    abi: decryptResultSignerAbi,
    functionName: 'decryptResultSigner',
    args: [],
  });

  if (isAddressEqual(expectedSigner, zeroAddress)) return false;
  if (!isAcceptedByTaskManager(signature)) return false;

  const ctHash = BigInt(handle);
  const messageHash = buildDecryptResultHash(ctHash, cleartext, chainId);

  try {
    const recovered = await recoverAddress({ hash: messageHash, signature });
    return isAddressEqual(recovered, expectedSigner);
  } catch {
    return false;
  }
}
