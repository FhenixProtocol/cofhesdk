import type { FheTypeValue } from '@cofhe/sdk';
import { devConsole } from './debug';

export const logBlockStart = (message: string) => {
  devConsole.log('┌──────────────────┬──────────────────────────────────────────────────');
  devConsole.log(`│ [COFHE]          │ ${message}`);
  devConsole.log('├──────────────────┴──────────────────────────────────────────────────');
};

export const logBlockMessage = (message: string) => {
  devConsole.log(`│ ${message}`);
};

export const logBlockEnd = () => {
  devConsole.log('└─────────────────────────────────────────────────────────────────────');
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
