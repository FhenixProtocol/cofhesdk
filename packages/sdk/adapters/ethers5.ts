import { createPublicClient, createWalletClient, custom, hexToBytes, isAddressEqual } from 'viem';
import { privateKeyToAccount, toAccount } from 'viem/accounts';
import type { Signer as AbstractSigner, Wallet, providers } from 'ethers5';
import { type AdapterResult } from './types.js';

type Ethers5Signer = AbstractSigner | Wallet;

export async function Ethers5Adapter(provider: providers.Provider, signer: Ethers5Signer): Promise<AdapterResult> {
  const address = (await signer.getAddress()) as `0x${string}`;
  // Create transport from provider
  const transport =
    provider && 'send' in provider && typeof provider.send === 'function'
      ? custom({
          request: async ({ method, params }: any) => {
            if (method === 'eth_signTypedData_v4' || method === 'personal_sign') {
              const requestedAddress = method === 'personal_sign' ? params[1] : params[0];
              if (!isAddressEqual(requestedAddress, address)) {
                throw new Error('Signing account does not match the supplied ethers signer.');
              }
              if (method === 'personal_sign') return signer.signMessage(hexToBytes(params[0]));
              if ('_signTypedData' in signer && typeof signer._signTypedData === 'function') {
                const { domain, types, message } = JSON.parse(params[1]);
                // Ethers derives the domain type itself and rejects it as a message type.
                const { EIP712Domain: _domainType, ...messageTypes } = types;
                return signer._signTypedData(domain, messageTypes, message);
              }
            }
            // @ts-ignore - ethers5 provider.send is not typed
            return provider.send(method, params ?? []);
          },
        })
      : (() => {
          throw new Error('Provider does not support EIP-1193 interface');
        })();

  // build a viem Account
  let account: ReturnType<typeof privateKeyToAccount> | ReturnType<typeof toAccount> | `0x${string}`;

  if ('privateKey' in signer && typeof (signer as Wallet).privateKey === 'string') {
    // Local (true offline) signing → works with Infura via sendRawTransaction
    account = privateKeyToAccount((signer as Wallet).privateKey as `0x${string}`);
  } else if (provider && typeof provider.send === 'function') {
    // Keep a JSON-RPC account; signing requests above delegate to the supplied signer.
    account = address; // JSON-RPC account (not local signing)
  } else {
    throw new Error('Signer does not expose a private key and no injected wallet is available.');
  }

  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account });

  return { publicClient, walletClient };
}
