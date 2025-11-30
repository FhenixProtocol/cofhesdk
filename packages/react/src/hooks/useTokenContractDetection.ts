import { getAbiItem, keccak256, toHex, type Address, type Abi } from 'viem';
import { useCofhePublicClient } from './useCofheConnection.js';

/**
 * Turn "transfer(address,uint256)" into 4-byte selector "0xa9059cbb"
 */
export function getSelector(signature: string): `0x${string}` {
  const hash = keccak256(toHex(signature));
  return (`0x${hash.slice(2, 10)}`) as `0x${string}`; // first 4 bytes
}

/**
 * Extract interesting selectors from ABI
 */
export function getSelectorsFromAbi(abi: Abi, names: string[]): `0x${string}`[] {
  return names.map((name) => {
    const item = getAbiItem({ abi, name, args: [] });
    if (!item || item.type !== 'function') {
      throw new Error(`Function ${name} not found in ABI`);
    }
    const inputs = item.inputs ?? [];
    const types = inputs.map((i) => i.type).join(',');
    const signature = `${item.name}(${types})`;
    return getSelector(signature);
  });
}

/**
 * Count how many selectors appear in bytecode
 */
export function countSelectorsInBytecode(
  bytecode: `0x${string}`,
  selectors: `0x${string}`[]
): number {
  const code = bytecode.toLowerCase();
  let score = 0;
  for (const sel of selectors) {
    if (code.includes(sel.slice(2).toLowerCase())) {
      score++;
    }
  }
  return score;
}

/**
 * Detect contract type by analyzing bytecode selectors
 * @param address - Contract address to detect
 * @param publicClient - Public client for reading bytecode
 * @param typeSelectors - Object mapping type names to selector getter functions
 * @returns Detected type name or null if not detected
 */
export async function detectContractType<T extends string>(
  address: Address,
  publicClient: NonNullable<ReturnType<typeof useCofhePublicClient>>,
  typeSelectors: Record<T, (abi: Abi) => `0x${string}`[]>,
  abis: Record<T, Abi>
): Promise<T | null> {
  const bytecode = await publicClient.getCode({ address });
  if (!bytecode) return null;

  const scores: Record<string, number> = {};
  for (const type of Object.keys(typeSelectors) as T[]) {
    const selectorGetter = typeSelectors[type];
    scores[type] = countSelectorsInBytecode(bytecode, selectorGetter(abis[type]));
  }

  // Choose type with best score, but only if score > 0
  let best: { type: T | null; score: number } = { type: null, score: 0 };
  for (const [type, score] of Object.entries(scores)) {
    if (score > best.score) {
      best = { type: type as T, score };
    }
  }

  if (!best.type || best.score === 0) return null;
  return best.type;
}

