export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

export const fromHexString = (hexString: string): Uint8Array => {
  const cleanString = hexString.length % 2 === 1 ? `0${hexString}` : hexString;
  const arr = cleanString.replace(/^0x/, '').match(/.{1,2}/g);
  if (!arr) return new Uint8Array();
  return new Uint8Array(arr.map((byte) => parseInt(byte, 16)));
};

export const toBigIntOrThrow = (value: bigint | string): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }

  try {
    return BigInt(value);
  } catch (error) {
    throw new Error('Invalid input: Unable to convert to bigint');
  }
};

export const validateBigIntInRange = (value: bigint, max: bigint, min: bigint = 0n): void => {
  if (typeof value !== 'bigint') {
    throw new Error('Value must be of type bigint');
  }

  if (value > max || value < min) {
    throw new Error(`Value out of range: ${max} - ${min}, try a different uint type`);
  }
};

// Helper function to convert hex string to bytes
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
