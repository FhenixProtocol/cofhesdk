import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';
import { useEffect, useRef } from 'react';
// import { usePublicClient, useWalletClient } from 'wagmi';
import { sepolia, baseSepolia } from '@cofhe/sdk/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, http } from 'viem';

const cofheConfig = createCofhesdkConfig({
  client: {
    supportedChains: [sepolia, baseSepolia],
    // useWorkers: true, // Enable Web Workers
  },
  widget: {},
});

// console.log('Cofhesdk Config:', cofheConfig);

const config = createCofhesdkConfig(cofheConfig);
const cofheSdkClient = createCofhesdkClient(config.client);

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  // const { data: walletClient } = useWalletClient();
  // const publicClient = usePublicClient();
  const visited = useRef(false);

  useEffect(
    () => {
      async function handleConnect() {
        if (visited.current) return;
        visited.current = true;
        // if (!publicClient || !walletClient) return;

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
        const connectionResult = await cofheSdkClient.connect(publicClient, walletClient);
        const initializationResults = await cofheSdkClient.initializationResults.keyFetchResult;
        debugger;
      }
      handleConnect();
    },
    [
      // walletClient, publicClient
    ]
  );

  return <CofheProvider client={cofheSdkClient}>{children}</CofheProvider>;
};
