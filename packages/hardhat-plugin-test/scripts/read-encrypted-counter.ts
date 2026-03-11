import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import hre from 'hardhat';
import fs from 'node:fs/promises';

// [!region docs-imports]
import { transformEncryptedReturnTypes } from '@cofhe/abi';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { chains } from '@cofhe/sdk/chains';
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

  const abi = [
    {
      type: 'function',
      name: 'getValue',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'bytes32', internalType: 'euint32' }],
    },
  ] as const;

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(sepoliaRpcUrl),
  });

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: http(sepoliaRpcUrl),
    account,
  });

  const config = createCofheConfig({ supportedChains: [chains.sepolia] });
  const client = createCofheClient(config);

  // [!region docs-snippet]
  await client.connect(publicClient, walletClient);
  await client.permits.getOrCreateSelfPermit();

  const raw = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: 'getValue',
    args: [],
  });

  const encrypted = transformEncryptedReturnTypes(abi, 'getValue', raw);
  const plaintext = await client.decryptForView(encrypted.ctHash, encrypted.utype).execute();

  console.log('Decrypted value:', plaintext);
  // [!endregion docs-snippet]
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
// #endregion docs

// [!region docs-twoslash]
async function readEncryptedCounter() {
  // Predeployed EncryptedCounter on Sepolia (see `deployments/sepolia.json`).
  const contractAddress = '0xbD0C2095d3C10782369547fd4C1644fEC7A82d36' as const;
  const account = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000000');

  const abi = [
    {
      type: 'function',
      name: 'getValue',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'bytes32', internalType: 'euint32' }],
    },
  ] as const;

  const publicClient = createPublicClient({ chain: sepolia, transport: http() });
  const walletClient = createWalletClient({ chain: sepolia, transport: http(), account });

  const config = createCofheConfig({ supportedChains: [chains.sepolia] });
  const client = createCofheClient(config);
  await client.connect(publicClient, walletClient);
  await client.permits.getOrCreateSelfPermit();

  const raw = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: 'getValue',
    args: [],
  });

  const encrypted = transformEncryptedReturnTypes(abi, 'getValue', raw);
  encrypted; //    ^?

  const plaintext = await client.decryptForView(encrypted.ctHash, encrypted.utype).execute();
  plaintext; //    ^?
}

readEncryptedCounter;
// [!endregion docs-twoslash]
