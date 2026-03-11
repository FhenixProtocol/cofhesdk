import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import hre from 'hardhat';
import fs from 'node:fs/promises';

// [!region docs-imports]
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
// [!endregion docs-imports]

// #region docs
dotenvConfig({ path: resolve(__dirname, '../../.env') });

function mustGetEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

function mustGetOneOfEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(`Missing env var: one of ${keys.join(', ')}`);
}

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org';
const privateKey = mustGetOneOfEnv(['PRIVATE_KEY', 'TEST_PRIVATE_KEY']) as `0x${string}`;
const contractAddressEnv = process.env.ENCRYPTED_COUNTER_ADDRESS as `0x${string}` | undefined;

const account = privateKeyToAccount(privateKey);

const abi = [
  {
    type: 'function',
    name: 'increment',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

async function deployEncryptedCounter() {
  const Counter = await hre.ethers.getContractFactory('EncryptedCounter');
  const counter = await Counter.deploy(0);
  await counter.waitForDeployment();
  return (await counter.getAddress()) as `0x${string}`;
}

async function getSavedDeploymentAddress(): Promise<`0x${string}` | undefined> {
  try {
    const outDir = resolve(__dirname, '../deployments');
    const p = resolve(outDir, `${hre.network.name}.json`);
    const raw = await fs.readFile(p, 'utf8');
    const json = JSON.parse(raw);
    if (typeof json?.address === 'string') return json.address as `0x${string}`;
    return undefined;
  } catch {
    return undefined;
  }
}

async function saveDeploymentAddress(address: `0x${string}`) {
  const outDir = resolve(__dirname, '../deployments');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    resolve(outDir, `${hre.network.name}.json`),
    JSON.stringify({ address, chainId: hre.network.config.chainId, deployedAt: new Date().toISOString() }, null, 2) +
      '\n',
    'utf8'
  );
}

async function main() {
  const saved = await getSavedDeploymentAddress();
  const contractAddress = contractAddressEnv ?? saved ?? (await deployEncryptedCounter());
  if (!contractAddressEnv && !saved) {
    await saveDeploymentAddress(contractAddress);
    console.log('Deployed EncryptedCounter at:', contractAddress);
    console.log('Tip: set ENCRYPTED_COUNTER_ADDRESS to override this deployment.');
  }

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(sepoliaRpcUrl),
  });

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: http(sepoliaRpcUrl),
    account,
  });

  // [!region docs-snippet]
  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: 'increment',
    args: [],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log('Increment tx:', hash);
  // [!endregion docs-snippet]
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
// #endregion docs

// [!region docs-twoslash]
declare const process: { env: Record<string, string | undefined> };

async function writeEncryptedCounter() {
  const privateKey = process.env.TEST_PRIVATE_KEY;
  if (!privateKey) throw new Error('Missing env var: TEST_PRIVATE_KEY');

  // Predeployed EncryptedCounter on Sepolia (see `deployments/sepolia.json`).
  const contractAddress = '0xbD0C2095d3C10782369547fd4C1644fEC7A82d36' as const;
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({ chain: sepolia, transport: http() });
  const walletClient = createWalletClient({ chain: sepolia, transport: http(), account });

  const abi = [
    {
      type: 'function',
      name: 'increment',
      stateMutability: 'nonpayable',
      inputs: [],
      outputs: [],
    },
  ] as const;

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: 'increment',
    args: [],
  });
  hash; //    ^?

  await publicClient.waitForTransactionReceipt({ hash });
}

writeEncryptedCounter;
// [!endregion docs-twoslash]
