import { type ACP, type SerializedPermit, GenerateSealingKey, ACPUtils } from './index.js';

// Mock permit for testing - using Bob's address as issuer
export const createMockPermit = async (overrides: Partial<ACP> = {}): Promise<ACP> => {
  const sealingPair = GenerateSealingKey();

  const fields = {
    name: 'Test ACP',
    type: 'self',
    issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
    expiration: 1000000000000,
    recipient: '0x0000000000000000000000000000000000000000',
    revokerData: 0,
    revokerContract: '0x0000000000000000000000000000000000000000',
    scope: 0,
    contracts: [] as ACP['contracts'],
    handles: [] as ACP['handles'],
    sealingKey: `0x${sealingPair.publicKey}` as const,
    sealingPair: sealingPair.serialize(),
    issuerSignature: '0x',
    recipientSignature: '0x',
    _signedDomain: undefined,
    ...overrides,
  } as const;

  const serializedPermit: SerializedPermit = {
    hash: ACPUtils.getHash(fields),
    ...fields,
  };

  return ACPUtils.deserialize(serializedPermit);
};
