import type { FheTypeValue } from '@cofhe/sdk';

export const logBlockStart = (message: string) => {
  console.log('┌──────────────────┬──────────────────────────────────────────────────');
  console.log(`│ [COFHE]          │ ${message}`);
  console.log('├──────────────────┴──────────────────────────────────────────────────');
};

export const logBlockMessage = (message: string) => {
  console.log(`│ ${message}`);
};

export const logBlockEnd = () => {
  console.log('└─────────────────────────────────────────────────────────────────────');
};

export const logBlockMessageAndEnd = (message: string) => {
  logBlockMessage(message);
  logBlockEnd();
};

export const fheTypeToString = (fheType: FheTypeValue) => {
  switch (fheType) {
    case 'bool':
      return 'ebool';
    case 'uint8':
      return 'euint8';
    case 'uint16':
      return 'euint16';
    case 'uint32':
      return 'euint32';
    case 'uint64':
      return 'euint64';
    case 'uint128':
      return 'euint128';
    case 'address':
      return 'eaddress';
    default:
      return 'unknown';
  }
};

export const plaintextToString = (fheType: FheTypeValue, plaintext: string | bigint | boolean) => {
  if (fheType === 'bool') {
    return plaintext === 1n || plaintext === true ? 'true' : 'false';
  }
  return plaintext;
};

export const encryptedValueToString = (fheType: FheTypeValue, handle: bigint) => {
  const hashStr = handle.toString();
  const truncated = hashStr.slice(0, 6) + '..' + hashStr.slice(hashStr.length - 6);

  return `${fheTypeToString(fheType)}(${truncated})`;
};
