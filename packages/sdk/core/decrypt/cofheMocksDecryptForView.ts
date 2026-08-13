import { type ACP, ACPUtils } from '@/permits';

import { type PublicClient } from 'viem';
import { MockThresholdNetworkAbi } from './MockThresholdNetworkAbi.js';
import { FheTypes } from '../types.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { MOCKS_THRESHOLD_NETWORK_ADDRESS } from '../consts.js';

export async function cofheMocksDecryptForView(
  ctHash: bigint | string,
  utype: FheTypes,
  permit: ACP,
  publicClient: PublicClient
): Promise<bigint> {
  const acp = ACPUtils.getPublic(permit, true);
  const permissionWithBigInts = {
    ...acp,
    expiration: BigInt(acp.expiration),
    revokerData: BigInt(acp.revokerData),
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
  const sealingKeyBigInt = BigInt(acp.sealingKey);
  const unsealed = sealedBigInt ^ sealingKeyBigInt;

  return unsealed;
}
