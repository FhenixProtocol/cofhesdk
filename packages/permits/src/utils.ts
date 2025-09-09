/* eslint-disable @typescript-eslint/no-explicit-any */

// Utility functions for sealing key operations

export const fromHexString = (hexString: string): Uint8Array => {
  const cleanString = hexString.length % 2 === 1 ? `0${hexString}` : hexString;
  const arr = cleanString.replace(/^0x/, "").match(/.{1,2}/g);
  if (!arr) return new Uint8Array();
  return new Uint8Array(arr.map((byte) => parseInt(byte, 16)));
};

export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

export function toBigInt(value: number | string | bigint | Uint8Array): bigint {
  if (typeof value === "string") {
    return BigInt(value);
  } else if (typeof value === "number") {
    return BigInt(value);
  } else if (typeof value === "object") {
    // Uint8Array
    return BigInt("0x" + toHexString(value));
  } else {
    return value as bigint;
  }
}

export function toBeArray(value: bigint | number): Uint8Array {
  const bigIntValue = typeof value === "number" ? BigInt(value) : value;
  const hex = bigIntValue.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : "0" + hex;
  return fromHexString(paddedHex);
}

export function isString(value: unknown) {
  if (typeof value !== "string") {
    throw new Error(
      `Expected value which is \`string\`, received value of type \`${typeof value}\`.`,
    );
  }
}

export function isNumber(value: unknown) {
  const is = typeof value === "number" && !Number.isNaN(value);
  if (!is) {
    throw new Error(
      `Expected value which is \`number\`, received value of type \`${typeof value}\`.`,
    );
  }
}

export function isBigIntOrNumber(value: unknown) {
  const is = typeof value === "bigint";

  if (!is) {
    try {
      isNumber(value);
    } catch (e) {
      throw new Error(
        `Value ${value} is not a number or bigint: ${typeof value}`,
      );
    }
  }
}

