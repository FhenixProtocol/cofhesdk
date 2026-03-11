// [!region docs-snippet]
import { transformEncryptedReturnTypes } from '@cofhe/abi';
import { Contract, JsonRpcProvider } from 'ethers';

// Predeployed test contract on Sepolia.
const contractAddress = '0x9e599dA5c7BA756641bA59DbecCc394CEdFC19f0' as const;
const rpcUrl =
  (globalThis as any).process?.env?.SEPOLIA_RPC_URL ??
  (globalThis as any).process?.env?.RPC_URL ??
  'https://rpc.sepolia.org';
// ---cut---

// Ethers: provider + contract call
const provider = new JsonRpcProvider(rpcUrl);

const abi = [
  {
    type: 'function',
    name: 'getValue',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'euint32' }],
  },
] as const;

const contract = new Contract(contractAddress, abi, provider);

// Read the raw encrypted return value.
const raw = await contract.getValue();

// Convert raw ABI values into `{ ctHash, utype }`.
const encrypted = transformEncryptedReturnTypes(abi, 'getValue', raw);

encrypted.ctHash; // ^?
encrypted.utype; // ^?
// [!endregion docs-snippet]

console.log('ctHash:', encrypted.ctHash);
console.log('utype:', encrypted.utype);
