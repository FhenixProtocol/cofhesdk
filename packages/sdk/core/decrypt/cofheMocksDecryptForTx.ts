import { type Permit, PermitUtils } from '@/permits';

import { type PublicClient } from 'viem';
import { sleep } from '../utils.js';
import { MockThresholdNetworkAbi } from './MockThresholdNetworkAbi.js';
import { FheTypes } from '../types.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { SigningKey, keccak256, solidityPacked, toBeHex, zeroPadValue } from 'ethers';
import { MOCKS_QUERY_DECRYPTER_ADDRESS } from '../consts.js';

export type DecryptForTxMocksResult = {
  ctHash: bigint;
  decryptedValue: bigint;
  signature: string;
};

export async function cofheMocksDecryptForTx(
  ctHash: bigint,
  utype: FheTypes,
  permit: Permit | null,
  publicClient: PublicClient,
  mocksDecryptForTxDelay: number
): Promise<DecryptForTxMocksResult> {
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
    // Must include all fields that the Permission struct requires
    permission = {
      issuer: '0x0000000000000000000000000000000000000000',
      expiration: 0n,
      recipient: '0x0000000000000000000000000000000000000000',
      validatorId: 0n,
      validatorContract: '0x0000000000000000000000000000000000000000',
      sealingKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
      issuerSignature: '0x',
      recipientSignature: '0x',
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
  // Generate a mock threshold network signature (in production, this would be the actual signature)
  // The signature must be valid for MockTaskManager verification.
  const chainId = await publicClient.getChainId();
  const ctHashBigInt = BigInt(ctHash);
  const resultBigInt = BigInt(result);
  const encryptionType = Number((ctHashBigInt & (0x7fn << 8n)) >> 8n);
  const packed = solidityPacked(
    ['uint256', 'uint32', 'uint64', 'bytes32'],
    [resultBigInt, encryptionType, BigInt(chainId), zeroPadValue(toBeHex(ctHashBigInt), 32)]
  );
  const messageHash = keccak256(packed);
  const mockPrivateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  const signature = new SigningKey(mockPrivateKey).sign(messageHash).serialized.slice(2); // no 0x prefix

  return {
    ctHash,
    decryptedValue: BigInt(result),
    signature,
  };
}
