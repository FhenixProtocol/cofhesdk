/**
 * Accounts and contracts that belong to one test file.
 *
 * The files of this project run in parallel against one Anvil. A file that shares an account with
 * another file races it for nonces, and a file that shares a SimpleTest races it for the one value
 * the contract stores. So a file takes nothing shared: it makes its accounts and deploys its
 * contract here, at the top of the file.
 */

import { inject } from 'vitest';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  toHex,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { simpleTestAbi } from '@cofhe/test-setup';

const rpc = inject('anvilRpc');
const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const publicClient = createPublicClient({ chain: anvil, transport: http(rpc), pollingInterval: 100 });

/** A new account with 10,000 ETH. Its key is random, so no other file can have the same one. */
export async function freshAccount(): Promise<PrivateKeyAccount> {
  const account = privateKeyToAccount(generatePrivateKey());
  await publicClient.request({
    method: 'anvil_setBalance' as never,
    params: [account.address, toHex(parseEther('10000'))] as never,
  });
  return account;
}

/** Deploys a SimpleTest that only this file writes to. The bytecode comes from the global setup. */
export async function deploySimpleTest(deployer: PrivateKeyAccount): Promise<Address> {
  const walletClient = createWalletClient({ chain: anvil, transport: http(rpc), account: deployer });
  const hash = await walletClient.deployContract({
    abi: simpleTestAbi,
    bytecode: inject('anvilSimpleTestBytecode') as Hex,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error('SimpleTest deployment has no contract address');
  return receipt.contractAddress;
}
