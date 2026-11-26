// Everything the harness does on the local chain. It talks to the node directly, never through
// the SDK under test, so a broken SDK cannot make a check pass or fail for the wrong reason.
import { createPublicClient, createTestClient, createWalletClient, http, pad, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';

/** Hardhat's first default account. Public knowledge: only ever use it on a local chain. */
export const ACCOUNT_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/** Where the hardhat plugin deploys the mock task manager, which keeps every plaintext. */
const MOCK_TASK_MANAGER = '0x0000000000000000000000000000000000005000';

const MOCK_STORAGE_ABI = [
  {
    type: 'function',
    name: 'mockStorage',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'inMockStorage',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
];

export function connectChain(rpcUrl) {
  const chain = { ...hardhat, rpcUrls: { default: { http: [rpcUrl] } } };
  const transport = http(rpcUrl);
  const account = privateKeyToAccount(ACCOUNT_KEY);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const testClient = createTestClient({ chain, transport, mode: 'hardhat' });

  let vault;

  return {
    rpcUrl,
    account,

    /** True once the node answers and the mock contracts are deployed on it. */
    async mocksReady() {
      try {
        const code = await publicClient.getCode({ address: MOCK_TASK_MANAGER });
        return !!code && code !== '0x';
      } catch {
        return false;
      }
    },

    async deployVault(artifact) {
      const hash = await walletClient.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      vault = { address: receipt.contractAddress, abi: artifact.abi };
      return vault.address;
    },

    readVault: (functionName, args = []) => publicClient.readContract({ ...vault, functionName, args }),

    async writeVault(functionName, args = []) {
      const hash = await walletClient.writeContract({ ...vault, functionName, args });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error(`${functionName} reverted`);
    },

    /** The plaintext behind an encrypted handle, or `undefined` when the handle holds nothing. */
    async plaintextOf(handle) {
      const ctHash = BigInt(typeof handle === 'string' ? pad(handle, { size: 32 }) : toHex(handle));
      if (ctHash === 0n) return undefined;
      const mock = { address: MOCK_TASK_MANAGER, abi: MOCK_STORAGE_ABI };
      const known = await publicClient.readContract({ ...mock, functionName: 'inMockStorage', args: [ctHash] });
      if (!known) return undefined;
      return publicClient.readContract({ ...mock, functionName: 'mockStorage', args: [ctHash] });
    },

    snapshot: () => testClient.snapshot(),
    revert: (id) => testClient.revert({ id }),
  };
}
