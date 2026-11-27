import { type ACP, ACPUtils } from '@/acps';

import { MockThresholdNetworkAbi } from './MockThresholdNetworkAbi.js';
import { FheTypes } from '../types.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { MOCKS_THRESHOLD_NETWORK_ADDRESS } from '../consts.js';
import { mapApiErrorCodeToCofheErrorCode, mockRejectionToApiErrorCode } from './apiError.js';
import { createMocksPublicClient, type MocksRequestFn } from '../mockClients.js';

export async function cofheMocksDecryptForView(
  ctHash: bigint | string,
  utype: FheTypes,
  acp: ACP,
  _mocksRequestFn: MocksRequestFn
): Promise<bigint> {
  const wireAcp = ACPUtils.getPublic(acp, true);
  const permissionWithBigInts = {
    ...wireAcp,
    expiration: BigInt(wireAcp.expiration),
    revokerData: BigInt(wireAcp.revokerData),
  };

  const mocksPublicClient = createMocksPublicClient(_mocksRequestFn);

  const [allowed, error, result] = await mocksPublicClient.readContract({
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
