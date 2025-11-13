import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

export function createMockWalletAndPublicClient() {
  // Create a mock private key for examples (DO NOT use in production)
  const mockPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const account = privateKeyToAccount(mockPrivateKey);

  // Create public client (provider) for Sepolia
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://sepolia.gateway.tenderly.co'), // Public Sepolia RPC
  });

  // Create wallet client (signer) for Sepolia
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://sepolia.gateway.tenderly.co'),
  });

  return {
    walletClient,
    publicClient,
  };
}
