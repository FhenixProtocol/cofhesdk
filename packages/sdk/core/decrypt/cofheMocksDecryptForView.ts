import { type ACP, ACPUtils } from '@/acps';

import { type PublicClient } from 'viem';
import { MockThresholdNetworkAbi } from './MockThresholdNetworkAbi.js';
import { FheTypes } from '../types.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { MOCKS_THRESHOLD_NETWORK_ADDRESS } from '../consts.js';
import { mapApiErrorCodeToCofheErrorCode, mockRejectionToApiErrorCode } from './apiError.js';

export async function cofheMocksDecryptForView(
  ctHash: bigint | string,
  utype: FheTypes,
  acp: ACP,
  publicClient: PublicClient
): Promise<bigint> {
  const wireAcp = ACPUtils.getPublic(acp, true);
  const permissionWithBigInts = {
    ...wireAcp,
    expiration: BigInt(wireAcp.expiration),
    revokerData: BigInt(wireAcp.revokerData),
  };

  const [allowed, error, result] = await publicClient.readContract({
    address: MOCKS_THRESHOLD_NETWORK_ADDRESS,
    abi: MockThresholdNetworkAbi,
    functionName: 'querySealOutput',
    args: [BigInt(ctHash), BigInt(utype), permissionWithBigInts],
  });

  if (error != '' || allowed == false) {
    const apiErrorCode = mockRejectionToApiErrorCode(error || 'NotAllowed', true);
    throw new CofheError({
      code: mapApiErrorCodeToCofheErrorCode(apiErrorCode, CofheErrorCode.SealOutputFailed),
      apiErrorCode,
      message: `mocks querySealOutput call failed: ${error || 'ACL Access Denied (NotAllowed)'}`,
    });
  }

  const sealedBigInt = BigInt(result);
  const sealingKeyBigInt = BigInt(acp.sealingKey);
  const unsealed = sealedBigInt ^ sealingKeyBigInt;

  return unsealed;
}
