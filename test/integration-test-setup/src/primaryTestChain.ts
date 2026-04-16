import registry from './primaryTestChainRegistry.json';

export type StoredValue = {
  /** The plaintext value that was trivially encrypted and stored */
  value: number;
  /** bytes32 ctHash (keccak of the ciphertext handle) */
  ctHash: string;
  /** bytes32 ciphertext handle (euint32) */
  handle: string;
};

export type PrimaryTestChainRegistry = {
  chainId: number;
  contractAddress: string;
  /** Private value stored via setValueTrivial — allowSender + allowThis */
  privateValue: StoredValue;
  /** Public value stored via setPublicValueTrivial — allowPublic */
  publicValue: StoredValue;
  /** Result of FHE.add(privateValue, addValueTrivial) — allowSender + allowThis */
  addedValue: StoredValue & { addend: number; expectedSum: number };
  /** ISO timestamp of when this registry was populated */
  initializedAt: string;
};

export const primaryTestChainRegistry = registry as unknown as PrimaryTestChainRegistry | Record<string, never>;

export function isPrimaryTestChainReady(
  reg: PrimaryTestChainRegistry | Record<string, never>,
): reg is PrimaryTestChainRegistry {
  return 'chainId' in reg && 'privateValue' in reg && 'publicValue' in reg && 'addedValue' in reg;
}
