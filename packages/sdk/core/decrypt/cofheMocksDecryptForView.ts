import { type Permit, PermitUtils } from '@/permits';

import { type PublicClient } from 'viem';
import { sleep } from '../utils.js';
import { MockThresholdNetworkAbi } from './MockThresholdNetworkAbi.js';
import { FheTypes } from '../types.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { MOCKS_THRESHOLD_NETWORK_ADDRESS } from '../consts.js';

export async function cofheMocksDecryptForView(
  ctHash: string,
  utype: FheTypes,
  permit: Permit,
  publicClient: PublicClient,
  mocksDecryptDelay: number
): Promise<bigint> {
  // Configurable delay before decrypting the output to simulate the CoFHE decrypt processing time
  // Recommended 1000ms on web
  // Recommended 0ms on hardhat (will be called during tests no need for fake delay)
  if (mocksDecryptDelay > 0) await sleep(mocksDecryptDelay);

  const permission = PermitUtils.getPermission(permit, true);
  const permissionWithBigInts = {
    ...permission,
    expiration: BigInt(permission.expiration),
    validatorId: BigInt(permission.validatorId),
  };

  const [allowed, error, result] = await publicClient.readContract({
    address: MOCKS_THRESHOLD_NETWORK_ADDRESS,
    abi: MockThresholdNetworkAbi,
    functionName: 'querySealOutput',
    args: [BigInt(ctHash), BigInt(utype), permissionWithBigInts],
  });

  if (error != '') {
    throw new CofheError({
      code: CofheErrorCode.SealOutputFailed,
      message: `mocks querySealOutput call failed: ${error}`,
    });
  }

  if (allowed == false) {
    throw new CofheError({
      code: CofheErrorCode.SealOutputFailed,
      message: `mocks querySealOutput call failed: ACL Access Denied (NotAllowed)`,
    });
  }

  const sealedBigInt = BigInt(result);
  const sealingKeyBigInt = BigInt(permission.sealingKey);
  const unsealed = sealedBigInt ^ sealingKeyBigInt;

  return unsealed;
}
