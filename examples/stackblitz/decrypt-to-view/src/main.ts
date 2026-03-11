import { transformEncryptedReturnTypes } from '@cofhe/abi';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/web';
import { chains } from '@cofhe/sdk/chains';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const DEFAULT_SEPOLIA_RPC_URL = 'https://rpc.sepolia.org';
const DEFAULT_COUNTER_ADDRESS = '0xbD0C2095d3C10782369547fd4C1644fEC7A82d36' as const;

function el(tag: string, text?: string) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function renderStatus(lines: string[]) {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  app.innerHTML = '';
  const pre = el('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.textContent = lines.join('\n');
  app.appendChild(pre);
}

async function main() {
  const sepoliaRpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL ?? DEFAULT_SEPOLIA_RPC_URL;
  const contractAddress =
    (import.meta.env.VITE_ENCRYPTED_COUNTER_ADDRESS as `0x${string}` | undefined) ?? DEFAULT_COUNTER_ADDRESS;

  const privateKey = import.meta.env.VITE_TEST_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    renderStatus([
      'Missing env var: VITE_TEST_PRIVATE_KEY',
      '',
      'Create a .env file (see .env.example) and use a throwaway key.',
    ]);
    return;
  }

  renderStatus(['Connecting…', `RPC: ${sepoliaRpcUrl}`, `Contract: ${contractAddress}`, '', 'Step 1/4: init clients']);

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(sepoliaRpcUrl) });
  const walletClient = createWalletClient({ chain: sepolia, transport: http(sepoliaRpcUrl), account });

  const config = createCofheConfig({ supportedChains: [chains.sepolia] });
  const client = createCofheClient(config);

  renderStatus([
    'Connecting…',
    `RPC: ${sepoliaRpcUrl}`,
    `Contract: ${contractAddress}`,
    '',
    'Step 2/4: connect CoFHE client',
  ]);

  await client.connect(publicClient, walletClient);

  renderStatus([
    'Connecting…',
    `RPC: ${sepoliaRpcUrl}`,
    `Contract: ${contractAddress}`,
    '',
    'Step 3/4: get or create self permit',
  ]);

  await client.permits.getOrCreateSelfPermit();

  const abi = [
    {
      type: 'function',
      name: 'getValue',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'bytes32', internalType: 'euint32' }],
    },
  ] as const;

  renderStatus([
    'Reading encrypted value…',
    `RPC: ${sepoliaRpcUrl}`,
    `Contract: ${contractAddress}`,
    '',
    'Step 4/4: read + decryptForView',
  ]);

  const raw = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: 'getValue',
    args: [],
  });

  const encrypted = transformEncryptedReturnTypes(abi, 'getValue', raw);
  const plaintext = await client.decryptForView(encrypted.ctHash, encrypted.utype).execute();

  renderStatus([
    'Done.',
    `Contract: ${contractAddress}`,
    `Account: ${account.address}`,
    '',
    `Encrypted ctHash: ${encrypted.ctHash}`,
    `Encrypted utype: ${String(encrypted.utype)}`,
    '',
    `Decrypted value: ${String(plaintext)}`,
  ]);
}

main().catch((err) => {
  console.error(err);
  renderStatus(['Error:', String(err)]);
});
