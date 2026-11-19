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

export const createMocksPublicClient = (requestFn: EIP1193RequestFn<PublicRpcSchema>) => {
  return createPublicClient({
    chain: hardhat,
    transport: custom({ request: requestFn }),
  });
};

export const createMocksWalletClient = (requestFn: EIP1193RequestFn<PublicRpcSchema>, privateKey: Hex) => {
  return createWalletClient({
    chain: hardhat,
    transport: custom({ request: requestFn }),
    account: privateKeyToAccount(privateKey),
  });
};
