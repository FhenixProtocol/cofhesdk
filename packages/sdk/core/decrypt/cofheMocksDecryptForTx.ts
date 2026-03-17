import { type Permit, PermitUtils } from '@/permits';

import { encodePacked, keccak256, type PublicClient } from 'viem';
import { sign } from 'viem/accounts';
import { MockThresholdNetworkAbi } from './MockThresholdNetworkAbi.js';
import { FheTypes } from '../types.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY } from '../consts.js';
import { MOCKS_THRESHOLD_NETWORK_ADDRESS } from '../consts.js';

export type DecryptForTxMocksResult = {
  ctHash: bigint | string;
  decryptedValue: bigint;
  signature: `0x${string}`;
};

export async function cofheMocksDecryptForTx(
  ctHash: bigint | string,
  utype: FheTypes,
  permit: Permit | null,
  publicClient: PublicClient
): Promise<DecryptForTxMocksResult> {
  let allowed: boolean;
  let error: string;
  let decryptedValue: bigint;

  // With permit
  if (permit !== null) {
    let permission = PermitUtils.getPermission(permit, true);
    const permissionWithBigInts = {
      ...permission,
      expiration: BigInt(permission.expiration),
      validatorId: BigInt(permission.validatorId),
    };

    [allowed, error, decryptedValue] = await publicClient.readContract({
      address: MOCKS_THRESHOLD_NETWORK_ADDRESS,
      abi: MockThresholdNetworkAbi,
      functionName: 'decryptForTxWithPermit',
      args: [BigInt(ctHash), permissionWithBigInts],
    });
  } else {
    // Without permit (global allowance)
    [allowed, error, decryptedValue] = await publicClient.readContract({
      address: MOCKS_THRESHOLD_NETWORK_ADDRESS,
      abi: MockThresholdNetworkAbi,
      functionName: 'decryptForTxWithoutPermit',
      args: [BigInt(ctHash)],
    });
  }

  if (error != '') {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `mocks decryptForTx call failed: ${error}`,
    });
  }

  if (allowed == false) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `mocks decryptForTx call failed: ACL Access Denied (NotAllowed)`,
    });
  }

  // decryptForTx returns plaintext directly (no sealing/unsealing needed)
  // Generate a mock threshold network signature (in production, this would be the actual signature)
  // The signature must be valid for MockTaskManager verification.
  const packed = encodePacked(['uint256', 'uint256'], [BigInt(ctHash), decryptedValue]);
  const messageHash = keccak256(packed);

  // Raw digest signature (no EIP-191 prefix). Must verify against OpenZeppelin ECDSA.recover(messageHash, signature).
  const signature = await sign({
    hash: messageHash,
    privateKey: MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY,
    to: 'hex',
  });

  return {
    ctHash,
    decryptedValue,
    signature,
  };
}
