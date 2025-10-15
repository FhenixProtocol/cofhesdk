import { getAddress } from 'viem';
import { FheTypes, FheUintUTypes, type UnsealedItem } from '../types.js';

export function uint160ToAddress(uint160: bigint): string {
  // Convert bigint to hex string and pad to 20 bytes (40 hex chars)
  const hexStr = uint160.toString(16).padStart(40, '0');

  // Add 0x prefix and convert to checksum address
  return getAddress('0x' + hexStr);
}

export const isValidUtype = (utype: FheTypes): boolean => {
  return (
    utype === FheTypes.Bool || utype === FheTypes.Uint160 || utype == null || FheUintUTypes.includes(utype as number)
  );
};

export const convertViaUtype = <U extends FheTypes>(utype: U, value: bigint): UnsealedItem<U> => {
  if (utype === FheTypes.Bool) {
    return !!value as UnsealedItem<U>;
  } else if (utype === FheTypes.Uint160) {
    return uint160ToAddress(value) as UnsealedItem<U>;
  } else if (utype == null || FheUintUTypes.includes(utype as number)) {
    return value as UnsealedItem<U>;
  } else {
    throw new Error(`convertViaUtype :: invalid utype :: ${utype}`);
  }
};
