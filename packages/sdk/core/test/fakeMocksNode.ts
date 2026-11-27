import { vi } from 'vitest';
import { type Hex } from 'viem';
import { hardhat } from 'viem/chains';
import { type MocksRequestFn } from '../mockClients.js';

/**
 * A request function standing in for a node with the mock contracts deployed, for tests that drive
 * the mocks path without a chain. `onCall` answers `eth_call` with ABI-encoded return data; the
 * methods a local account needs to send a transaction get fixed answers.
 */
export const fakeMocksNode = (onCall: (data: Hex) => Hex) => {
  const methods: string[] = [];
  const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
    methods.push(method);
    switch (method) {
      case 'eth_call':
        return onCall((params as [{ data: Hex }])[0].data);
      case 'eth_chainId':
        return `0x${hardhat.id.toString(16)}`;
      case 'eth_getTransactionCount':
      case 'eth_maxPriorityFeePerGas':
        return '0x0';
      case 'eth_estimateGas':
        return '0x5208';
      case 'eth_gasPrice':
        return '0x1';
      case 'eth_getBlockByNumber':
        return { baseFeePerGas: '0x1', number: '0x1', hash: `0x${'00'.repeat(32)}` };
      case 'eth_sendRawTransaction':
        return `0x${'11'.repeat(32)}`;
      default:
        throw new Error(`unexpected ${method}`);
    }
  });

  return {
    request: request as unknown as MocksRequestFn,
    /** Every RPC method requested so far, in order */
    methods,
    sent: () => methods.filter((method) => method === 'eth_sendRawTransaction').length,
  };
};
