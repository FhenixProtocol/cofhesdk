import { type Permit, PermitUtils } from '@/permits';

import { type PublicClient } from 'viem';
import { sleep } from '../utils.js';
import { MockQueryDecrypterAbi } from './MockQueryDecrypterAbi.js';
import { FheTypes } from '../types.js';
import { CofhesdkError, CofhesdkErrorCode } from '../error.js';

// Address the Mock Query Decrypter contract is deployed to on the Hardhat chain
export const MockQueryDecrypterAddress = '0x0000000000000000000000000000000000000200';

export async function cofheMocksSealOutput(
  ctHash: bigint,
  utype: FheTypes,
  permit: Permit,
  publicClient: PublicClient,
  mocksSealOutputDelay: number
): Promise<bigint> {
  // Configurable delay before decrypting the output to simulate the CoFHE decrypt processing time
  // Recommended 1000ms on web
  // Recommended 0ms on hardhat (will be called during tests no need for fake delay)
  if (mocksSealOutputDelay > 0) await sleep(mocksSealOutputDelay);

  const permission = PermitUtils.getPermission(permit, true);
  const permissionWithBigInts = {
    ...permission,
    expiration: BigInt(permission.expiration),
    validatorId: BigInt(permission.validatorId),
  };

  const [allowed, error, result] = await publicClient.readContract({
    address: MockQueryDecrypterAddress,
    abi: MockQueryDecrypterAbi,
    functionName: 'querySealOutput',
    args: [ctHash, BigInt(utype), permissionWithBigInts],
  });

  if (error != '') {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputFailed,
      message: `mocks querySealOutput call failed: ${error}`,
    });
  }

  if (allowed == false) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputFailed,
      message: `mocks querySealOutput call failed: ACL Access Denied (NotAllowed)`,
    });
  }

  const sealedBigInt = BigInt(result);
  const sealingKeyBigInt = BigInt(permission.sealingKey);
  const unsealed = sealedBigInt ^ sealingKeyBigInt;

  return unsealed;
}
