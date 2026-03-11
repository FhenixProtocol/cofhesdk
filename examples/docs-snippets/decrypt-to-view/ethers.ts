// [!region docs-snippet]
import { transformEncryptedReturnTypes } from '@cofhe/abi';
import { BrowserProvider, Contract } from 'ethers';

// Predeployed test contract on Sepolia.
const contractAddress = '0xbD0C2095d3C10782369547fd4C1644fEC7A82d36' as const;

declare const ethereum: unknown;
// ---cut---

// Ethers: provider + contract call
const provider = new BrowserProvider(ethereum as any);

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
