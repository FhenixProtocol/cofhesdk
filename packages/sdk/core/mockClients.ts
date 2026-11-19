import {
  createPublicClient,
  createWalletClient,
  custom,
  type EIP1193RequestFn,
  type Hex,
  type PublicRpcSchema,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';

/**
 * The request function the SDK reaches the mock contracts through on a mocks chain: it reads from
 * them, and sends the zk verifier signer's transactions.
 */
export type MocksRequestFn = EIP1193RequestFn<PublicRpcSchema>;

export const createMocksPublicClient = (requestFn: MocksRequestFn) => {
  return createPublicClient({
    chain: hardhat,
    transport: custom({ request: requestFn }),
  });
};

export const createMocksWalletClient = (requestFn: MocksRequestFn, privateKey: Hex) => {
  return createWalletClient({
    chain: hardhat,
    transport: custom({ request: requestFn }),
    account: privateKeyToAccount(privateKey),
  });
};
