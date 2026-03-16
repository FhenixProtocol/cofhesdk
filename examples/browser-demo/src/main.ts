import { createCofheClient, createCofheConfig } from '@cofhe/sdk/web';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { chains } from '@cofhe/sdk/chains';
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { sepolia } from 'viem/chains';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};

const DEFAULT_CONTRACT_ADDRESS =
  (localStorage.getItem('cofhe-demo-contract') as `0x${string}` | null) ??
  // This is the predeployed demo contract used in the docs snippets.
  // It may not support `setValue(InEuint32)`; you can deploy your own and paste the address.
  ('0x9e599dA5c7BA756641bA59DbecCc394CEdFC19f0' as const);

let contractAddress: `0x${string}` = DEFAULT_CONTRACT_ADDRESS;

const logEl = document.getElementById('log') as HTMLPreElement;
const btnConnect = document.getElementById('connect') as HTMLButtonElement;
const btnWrite = document.getElementById('write') as HTMLButtonElement;
const btnRead = document.getElementById('read') as HTMLButtonElement;
const btnSetAddress = document.getElementById('setAddress') as HTMLButtonElement;

function log(message: string) {
  logEl.textContent = `${new Date().toISOString()} ${message}\n${logEl.textContent ?? ''}`;
}

function getEthereum(): EthereumProvider {
  const eth = (globalThis as any).ethereum as EthereumProvider | undefined;
  if (!eth?.request) {
    throw new Error('window.ethereum not found. Install MetaMask (or another injected wallet).');
  }
  return eth;
}

function assertUint32(value: bigint) {
  if (value < 0n || value > 0xffff_ffffn) {
    throw new Error('Value must fit into uint32 (0 .. 4294967295).');
  }
}

function normalizeAddress(input: string): `0x${string}` {
  return getAddress(input) as `0x${string}`;
}

function promptContractAddress() {
  const next = prompt(
    'Contract address (0x...).\n\nTip: Deploy the demo contract (see examples/browser-demo/README.md), then paste its address here.',
    contractAddress
  );
  if (!next) return;
  contractAddress = normalizeAddress(next);
  localStorage.setItem('cofhe-demo-contract', contractAddress);
  alert(`Using contract: ${contractAddress}`);
}

const browserValueStoreAbi = [
  {
    type: 'function',
    name: 'getValue',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'euint32' }],
  },
  {
    type: 'function',
    name: 'setValue',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'inValue',
        type: 'tuple',
        internalType: 'struct InEuint32',
        components: [
          { name: 'ctHash', type: 'uint256', internalType: 'uint256' },
          { name: 'securityZone', type: 'uint8', internalType: 'uint8' },
          { name: 'utype', type: 'uint8', internalType: 'uint8' },
          { name: 'signature', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const;

const config = createCofheConfig({ supportedChains: [chains.sepolia] });
const cofhe = createCofheClient(config);

let publicClient: PublicClient;
let walletClient: WalletClient;
let account: `0x${string}`;

async function connect() {
  log('Connecting to wallet…');
  const ethereum = getEthereum();

  const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.[0]) throw new Error('No account returned from wallet');
  account = normalizeAddress(accounts[0]);

  publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(ethereum as any),
  });

  walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(ethereum as any),
    account,
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    // Prompt a switch in the injected wallet (MetaMask, etc.).
    // This keeps the demo aligned with the Sepolia-only config.
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${sepolia.id.toString(16)}` }],
      });
    } catch {
      throw new Error(`Please switch your wallet network to Sepolia (chainId ${sepolia.id}). Current: ${chainId}`);
    }
  }

  const chainIdAfter = await publicClient.getChainId();
  if (chainIdAfter !== sepolia.id) {
    throw new Error(`Please switch your wallet network to Sepolia (chainId ${sepolia.id}).`);
  }

  await cofhe.connect(publicClient, walletClient);
  log(`Connected: ${account} on chainId ${chainIdAfter}`);

  log('Ensuring self-permit (stored locally)…');
  await cofhe.permits.getOrCreateSelfPermit();
  log('Permit ready.');
}

async function writeEncryptedValue() {
  const raw = prompt('Enter uint32 value to encrypt + store:', '42');
  if (raw == null) return;

  const value = BigInt(raw.trim());
  assertUint32(value);

  log(`Encrypting ${value}…`);
  const [encrypted] = await cofhe
    .encryptInputs([Encryptable.uint32(value)])
    .onStep((step, ctx) => {
      if (ctx?.isStart) log(`encrypt step start: ${step}`);
      if (ctx?.isEnd) log(`encrypt step end: ${step} (${ctx.duration}ms)`);
    })
    .execute();

  log('Sending tx…');
  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: browserValueStoreAbi,
    functionName: 'setValue',
    args: [
      {
        ctHash: encrypted.ctHash,
        securityZone: encrypted.securityZone,
        utype: encrypted.utype,
        signature: encrypted.signature as Hex,
      },
    ],
    account,
  });

  log(`Tx sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  log(`Tx confirmed in block ${receipt.blockNumber}`);

  alert('Encrypted value stored successfully.');
}

async function readAndDecryptValue() {
  log('Reading encrypted handle…');
  const ctHash = await publicClient.readContract({
    address: contractAddress,
    abi: browserValueStoreAbi,
    functionName: 'getValue',
    args: [],
  });

  log(`ctHash: ${ctHash}`);
  log('Decrypting for view…');
  const unsealed = await cofhe.decryptForView(ctHash, FheTypes.Uint32).execute();

  log(`decrypted (uint32): ${unsealed}`);
  alert(`Decrypted value: ${unsealed.toString()}`);
}

function requireConnected() {
  if (!publicClient || !walletClient || !account) {
    throw new Error('Not connected. Click “Connect wallet” first.');
  }
}

btnConnect.onclick = async () => {
  try {
    await connect();
  } catch (err) {
    console.error(err);
    alert((err as Error)?.message ?? String(err));
  }
};

btnSetAddress.onclick = () => {
  try {
    promptContractAddress();
  } catch (err) {
    console.error(err);
    alert((err as Error)?.message ?? String(err));
  }
};

btnWrite.onclick = async () => {
  try {
    requireConnected();
    await writeEncryptedValue();
  } catch (err) {
    console.error(err);
    alert((err as Error)?.message ?? String(err));
  }
};

btnRead.onclick = async () => {
  try {
    requireConnected();
    await readAndDecryptValue();
  } catch (err) {
    console.error(err);
    alert((err as Error)?.message ?? String(err));
  }
};

log(`Ready. Contract: ${contractAddress}`);
log('1) Connect wallet  2) Set contract address  3) Write/Read');
