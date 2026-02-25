import { type Permit, PermitUtils } from '@/permits';

import { type PublicClient } from 'viem';
import { sleep } from '../utils.js';
import { MockThresholdNetworkAbi } from './MockThresholdNetworkAbi.js';
import { FheTypes } from '../types.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { MOCKS_QUERY_DECRYPTER_ADDRESS } from '../consts.js';

export async function cofheMocksDecryptForTx(
  ctHash: bigint,
  utype: FheTypes,
  permit: Permit | null,
  publicClient: PublicClient,
  mocksDecryptForTxDelay: number
): Promise<bigint> {
  // Configurable delay before decrypting to simulate the CoFHE decrypt processing time
  // Recommended 1000ms on web
  // Recommended 0ms on hardhat (will be called during tests no need for fake delay)
  if (mocksDecryptForTxDelay > 0) await sleep(mocksDecryptForTxDelay);

  // Prepare permission object - null/empty permit means no permission (global allowance check)
  let permission: any;
  if (permit !== null) {
    permission = PermitUtils.getPermission(permit, true);
    permission = {
      ...permission,
      expiration: BigInt(permission.expiration),
      validatorId: BigInt(permission.validatorId),
    };
  } else {
    // Empty permission with zero issuer for global allowance check
    permission = {
      issuer: '0x0000000000000000000000000000000000000000' as const,
      sealingKey: 0n,
      expiration: 0n,
      validatorId: 0n,
      signature: '0x' as const,
    };
  }

  const [allowed, error, result] = await publicClient.readContract({
    address: MOCKS_QUERY_DECRYPTER_ADDRESS,
    abi: MockThresholdNetworkAbi,
    functionName: 'decryptForTx',
    args: [ctHash, permission],
  });

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
  return BigInt(result);
}
