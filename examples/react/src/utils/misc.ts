import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, sepolia } from 'viem/chains';

const chains = [baseSepolia, sepolia] as const;
const transports = {
  [sepolia.id]: http('https://sepolia.gateway.tenderly.co'),
  [baseSepolia.id]: http('https://base-sepolia.gateway.tenderly.co'),
} as const;

export function createMockWalletAndPublicClient(chainId: number): {
  walletClient: WalletClient;
  publicClient: PublicClient;
} {
  // Create a mock private key for examples (DO NOT use in production)
  const mockPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const account = privateKeyToAccount(mockPrivateKey);

  const chain = chains.find((c) => c.id === chainId);
  if (!chain) {
    throw new Error(`Chain with ID ${chainId} not found in configured chains.`);
  }
  const transport = transports[chain.id];
  if (!transport) {
    throw new Error(`Transport for chain ID ${chainId} not found in configured transports.`);
  }
  // Create public client (provider)
  const publicClient = createPublicClient({
    chain,
    transport,
  });

  // Create wallet client (signer)
  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  // TODO: connection error is suppressed now by default.
  // i.e. if on auto-connection there's an error, it's just suppressed.
  // don't we need to provide a way to handle error?
  // options
  //  -> by passing throwOnError (via config?) and wrapping with user's ErrorBoundary
  //  -> by passing onError function
  // (walletClient.account.address as any) = undefined;

  return {
    walletClient,
    publicClient: publicClient as PublicClient,
  };
}
