// The local environment these scripts run against. Provided: do not change.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicClient, createWalletClient, http, type Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';

const root = join(__dirname, '..');

type Env = { rpcUrl: string; chainId: number; privateKey: `0x${string}`; vaultAddress: `0x${string}` };

export const env: Env = JSON.parse(readFileSync(join(root, 'eval-env.json'), 'utf8'));

/** ABI of contracts/EvalVault.sol */
export const vaultAbi: Abi = JSON.parse(
  readFileSync(join(root, 'artifacts/contracts/EvalVault.sol/EvalVault.json'), 'utf8')
).abi;

export const vaultAddress = env.vaultAddress;

export const account = privateKeyToAccount(env.privateKey);

const chain = { ...hardhat, rpcUrls: { default: { http: [env.rpcUrl] } } };

export const publicClient = createPublicClient({ chain, transport: http(env.rpcUrl) });

export const walletClient = createWalletClient({ account, chain, transport: http(env.rpcUrl) });
