import { createPublicClient, createWalletClient, custom } from 'viem';
import { privateKeyToAccount, toAccount } from 'viem/accounts';
import type { Signer as AbstractSigner, Wallet, providers } from 'ethers5';
import { type AdapterResult } from './types.js';

type Ethers5Signer = AbstractSigner | Wallet;

export async function Ethers5Adapter(provider: providers.Provider, signer: Ethers5Signer): Promise<AdapterResult> {
  // Create transport from provider
  const transport =
    provider && 'send' in provider && typeof provider.send === 'function'
      ? // @ts-ignore - ethers5 provider.send is not typed
        custom({ request: ({ method, params }: any) => provider.send(method, params ?? []) })
      : (() => {
          throw new Error('Provider does not support EIP-1193 interface');
        })();

  // build a viem Account
  const address = (await signer.getAddress()) as `0x${string}`;
  let account: ReturnType<typeof privateKeyToAccount> | ReturnType<typeof toAccount> | `0x${string}`;

  if ('privateKey' in signer && typeof (signer as Wallet).privateKey === 'string') {
    // Local (true offline) signing → works with Infura via sendRawTransaction
    account = privateKeyToAccount((signer as Wallet).privateKey as `0x${string}`);
  } else if (provider && typeof provider.send === 'function') {
    // Injected wallet (MetaMask/Coinbase) → wallet signs via eth_sendTransaction
    account = address; // JSON-RPC account (not local signing)
  } else {
    throw new Error('Signer does not expose a private key and no injected wallet is available.');
  }

  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account });

  return { publicClient, walletClient };
}
