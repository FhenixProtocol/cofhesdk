import { type PublicClient, type WalletClient } from 'viem';

export async function WagmiAdapter(walletClient: WalletClient, publicClient: PublicClient) {
  if (!walletClient) {
    throw new Error('WalletClient is required');
  }

  if (!publicClient) {
    throw new Error('PublicClient is required');
  }

  // Wagmi provides real viem clients, so we just pass them through
  return {
    publicClient,
    walletClient,
  };
}
