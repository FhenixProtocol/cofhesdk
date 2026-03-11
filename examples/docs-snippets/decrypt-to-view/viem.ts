// [!region docs-snippet]
import { transformEncryptedReturnTypes } from '@cofhe/abi';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const rpcUrl =
  (globalThis as any).process?.env?.SEPOLIA_RPC_URL ??
  (globalThis as any).process?.env?.RPC_URL ??
  'https://rpc.sepolia.org';

// Predeployed test contract on Sepolia.
const contractAddress = '0xbD0C2095d3C10782369547fd4C1644fEC7A82d36' as const;

// ---cut---

// Viem: public client + contract call
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

const abi = [
  {
    type: 'function',
    name: 'getValue',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'euint32' }],
  },
] as const;

// Read the raw encrypted return value.
const raw = await publicClient.readContract({
  address: contractAddress,
  abi,
  functionName: 'getValue',
  args: [],
});

// Convert raw ABI values into `{ ctHash, utype }`.
const encrypted = transformEncryptedReturnTypes(abi, 'getValue', raw);

encrypted.ctHash; // ^?
encrypted.utype; // ^?
// [!endregion docs-snippet]

console.log('ctHash:', encrypted.ctHash);
console.log('utype:', encrypted.utype);
