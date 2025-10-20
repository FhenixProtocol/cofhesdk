/* eslint-disable no-unused-vars */

import { CofhesdkError, CofhesdkErrorCode } from '../error.js';
import { type EncryptableItem, FheTypes } from '../types.js';
import { toBigIntOrThrow, validateBigIntInRange, toHexString, hexToBytes } from '../utils.js';

// ===== TYPES =====

/**
 * Optional data for worker-based proof generation
 */
export type ZkProveWorkerData = {
  fheKeyHex: string;
  crsHex: string;
  items: EncryptableItem[];
  useWorker?: boolean;
};

export type VerifyResultRaw = {
  ct_hash: string;
  signature: string;
  recid: number;
};

export type VerifyResult = {
  ct_hash: string;
  signature: string;
};

export type ZkProvenCiphertextList = {
  serialize(): Uint8Array;
};

export type ZkCompactPkeCrs = {
  free(): void;
  serialize(compress: boolean): Uint8Array;
  safe_serialize(serialized_size_limit: bigint): Uint8Array;
};

export type ZkCompactPkeCrsConstructor = {
  deserialize(buffer: Uint8Array): ZkCompactPkeCrs;
  safe_deserialize(buffer: Uint8Array, serialized_size_limit: bigint): ZkCompactPkeCrs;
  from_config(config: unknown, max_num_bits: number): ZkCompactPkeCrs;
  deserialize_from_public_params(buffer: Uint8Array): ZkCompactPkeCrs;
  safe_deserialize_from_public_params(buffer: Uint8Array, serialized_size_limit: bigint): ZkCompactPkeCrs;
};

export type ZkCiphertextListBuilder = {
  push_boolean(data: boolean): void;
  push_u8(data: number): void;
  push_u16(data: number): void;
  push_u32(data: number): void;
  push_u64(data: bigint): void;
  push_u128(data: bigint): void;
  push_u160(data: bigint): void;
  build_with_proof_packed(
    crs: ZkCompactPkeCrs,
    metadata: Uint8Array,
    computeLoad: 1 // ZkComputeLoad.Verify
  ): ZkProvenCiphertextList;
};

export type ZkBuilderAndCrsGenerator = (
  fhe: string,
  crs: string
) => { zkBuilder: ZkCiphertextListBuilder; zkCrs: ZkCompactPkeCrs };

// ===== CONSTANTS =====

export const MAX_UINT8: bigint = 255n;
export const MAX_UINT16: bigint = 65535n;
export const MAX_UINT32: bigint = 4294967295n;
export const MAX_UINT64: bigint = 18446744073709551615n; // 2^64 - 1
export const MAX_UINT128: bigint = 340282366920938463463374607431768211455n; // 2^128 - 1
export const MAX_UINT256: bigint = 115792089237316195423570985008687907853269984665640564039457584007913129640319n; // 2^256 - 1
export const MAX_UINT160: bigint = 1461501637330902918203684832716283019655932542975n; // 2^160 - 1
export const MAX_ENCRYPTABLE_BITS: number = 2048;

// ===== CORE FUNCTIONS =====

export const zkPack = (items: EncryptableItem[], builder: ZkCiphertextListBuilder): ZkCiphertextListBuilder => {
  let totalBits = 0;
  for (const item of items) {
    switch (item.utype) {
      case FheTypes.Bool: {
        builder.push_boolean(item.data);
        totalBits += 1;
        break;
      }
      case FheTypes.Uint8: {
        const bint = toBigIntOrThrow(item.data);
        validateBigIntInRange(bint, MAX_UINT8);
        builder.push_u8(parseInt(bint.toString()));
        totalBits += 8;
        break;
      }
      case FheTypes.Uint16: {
        const bint = toBigIntOrThrow(item.data);
        validateBigIntInRange(bint, MAX_UINT16);
        builder.push_u16(parseInt(bint.toString()));
        totalBits += 16;
        break;
      }
      case FheTypes.Uint32: {
        const bint = toBigIntOrThrow(item.data);
        validateBigIntInRange(bint, MAX_UINT32);
        builder.push_u32(parseInt(bint.toString()));
        totalBits += 32;
        break;
      }
      case FheTypes.Uint64: {
        const bint = toBigIntOrThrow(item.data);
        validateBigIntInRange(bint, MAX_UINT64);
        builder.push_u64(bint);
        totalBits += 64;
        break;
      }
      case FheTypes.Uint128: {
        const bint = toBigIntOrThrow(item.data);
        validateBigIntInRange(bint, MAX_UINT128);
        builder.push_u128(bint);
        totalBits += 128;
        break;
      }
      // [U256-DISABLED]
      // case FheTypes.Uint256: {
      //   const bint = toBigIntOrThrow(item.data);
      //   validateBigIntInRange(bint, MAX_UINT256);
      //   builder.push_u256(bint);
      //   totalBits += 256;
      //   break;
      // }
      case FheTypes.Uint160: {
        const bint = toBigIntOrThrow(item.data);
        validateBigIntInRange(bint, MAX_UINT160);
        builder.push_u160(bint);
        totalBits += 160;
        break;
      }
      default: {
        throw new CofhesdkError({
          code: CofhesdkErrorCode.ZkPackFailed,
          message: `Invalid utype: ${(item as any).utype}`,
          hint: `Ensure that the utype is valid, using the Encryptable type, for example: Encryptable.uint128(100n)`,
          context: {
            item,
          },
        });
      }
    }
  }

  if (totalBits > MAX_ENCRYPTABLE_BITS) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkPackFailed,
      message: `Total bits ${totalBits} exceeds ${MAX_ENCRYPTABLE_BITS}`,
      hint: `Ensure that the total bits of the items to encrypt does not exceed ${MAX_ENCRYPTABLE_BITS}`,
      context: {
        totalBits,
        maxBits: MAX_ENCRYPTABLE_BITS,
        items,
      },
    });
  }

  return builder;
};

// Global worker function reference (set by web platform)
let zkProveWithWorkerFn: ((
  fheKeyHex: string,
  crsHex: string,
  items: EncryptableItem[],
  address: string,
  securityZone: number,
  chainId: number
) => Promise<Uint8Array>) | null = null;

/**
 * Set the worker function (called by web platform initialization)
 */
export function setZkProveWorkerFunction(
  fn: ((
    fheKeyHex: string,
    crsHex: string,
    items: EncryptableItem[],
    address: string,
    securityZone: number,
    chainId: number
  ) => Promise<Uint8Array>) | null
) {
  zkProveWithWorkerFn = fn;
}

export const zkProve = async (
  builder: ZkCiphertextListBuilder,
  crs: ZkCompactPkeCrs,
  address: string,
  securityZone: number,
  chainId: number,
  workerData?: ZkProveWorkerData
): Promise<Uint8Array> => {
  // Try worker path if data is available and worker is enabled
  if (workerData?.useWorker && zkProveWithWorkerFn) {
    try {
      return await zkProveWithWorkerFn(
        workerData.fheKeyHex,
        workerData.crsHex,
        workerData.items,
        address,
        securityZone,
        chainId
      );
    } catch (error) {
      // Fall back to main thread on worker error
      console.warn('[zkProve] Worker failed, falling back to main thread:', error);
    }
  }

  // Main thread path (original implementation)
  const metadata = constructZkPoKMetadata(address, securityZone, chainId);

  return new Promise((resolve) => {
    setTimeout(() => {
      const compactList = builder.build_with_proof_packed(
        crs,
        metadata,
        1 // ZkComputeLoad.Verify
      );

      resolve(compactList.serialize());
    }, 0);
  });
};

export const constructZkPoKMetadata = (accountAddr: string, securityZone: number, chainId: number): Uint8Array => {
  // Decode the account address from hex
  const accountAddrNoPrefix = accountAddr.startsWith('0x') ? accountAddr.slice(2) : accountAddr;
  const accountBytes = hexToBytes(accountAddrNoPrefix);

  // Encode chainId as 32 bytes (u256) in big-endian format
  const chainIdBytes = new Uint8Array(32);

  // Since chain IDs are typically small numbers, we can just encode them
  // directly without BigInt operations, filling only the necessary bytes
  // from the right (least significant)
  let value = chainId;
  for (let i = 31; i >= 0 && value > 0; i--) {
    chainIdBytes[i] = value & 0xff;
    value = value >>> 8;
  }

  const metadata = new Uint8Array(1 + accountBytes.length + 32);
  metadata[0] = securityZone;
  metadata.set(accountBytes, 1);
  metadata.set(chainIdBytes, 1 + accountBytes.length);

  return metadata;
};

export const zkVerify = async (
  verifierUrl: string,
  serializedBytes: Uint8Array,
  address: string,
  securityZone: number,
  chainId: number
): Promise<VerifyResult[]> => {
  // Convert bytearray to hex string
  const packed_list = toHexString(serializedBytes);

  const sz_byte = new Uint8Array([securityZone]);

  // Construct request payload
  const payload = {
    packed_list,
    account_addr: address,
    security_zone: sz_byte[0],
    chain_id: chainId,
  };

  const body = JSON.stringify(payload);

  // Send request to verification server
  try {
    const response = await fetch(`${verifierUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      // Get the response body as text for better error details
      const errorBody = await response.text();
      throw new CofhesdkError({
        code: CofhesdkErrorCode.ZkVerifyFailed,
        message: `HTTP error! ZK proof verification failed - ${errorBody}`,
      });
    }

    const json = (await response.json()) as { status: string; data: VerifyResultRaw[]; error: string };

    if (json.status !== 'success') {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.ZkVerifyFailed,
        message: `ZK proof verification response malformed - ${json.error}`,
      });
    }

    return json.data.map(({ ct_hash, signature, recid }) => {
      return {
        ct_hash,
        signature: concatSigRecid(signature, recid),
      };
    });
  } catch (e) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkVerifyFailed,
      message: `ZK proof verification failed`,
      cause: e instanceof Error ? e : undefined,
    });
  }
};

const concatSigRecid = (signature: string, recid: number): string => {
  return signature + (recid + 27).toString(16).padStart(2, '0');
};
