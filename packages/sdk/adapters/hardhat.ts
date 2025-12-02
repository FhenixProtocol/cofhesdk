import { createPublicClient, createWalletClient, custom } from 'viem';
import { type AdapterResult } from './types.js';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers.js';

export async function HardhatSignerAdapter(signer: HardhatEthersSigner): Promise<AdapterResult> {
  // Get provider from signer
  const provider = signer.provider;
  if (!provider) {
    throw new Error('Signer must have a provider');
  }

  // Create transport from provider (Hardhat providers are EIP-1193 compatible)
  const transport = custom({
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if ('request' in provider && typeof provider.request === 'function') {
        return await provider.request({ method, params });
      } else if ('send' in provider && typeof provider.send === 'function') {
        return await (provider as { send: (method: string, params?: unknown[]) => Promise<unknown> }).send(
          method,
          params || []
        );
      } else {
        throw new Error('Provider does not support EIP-1193 request method');
      }
    },
  });

  // Get account from signer for local signing
  const address = await signer.getAddress();
  const account = address as `0x${string}`;

  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account });

  return { publicClient, walletClient };
}
