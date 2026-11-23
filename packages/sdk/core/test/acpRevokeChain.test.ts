import { describe, it, expect } from 'vitest';
import { createWalletClient, custom, decodeFunctionData, type Hex, type PublicClient } from 'viem';
import { acps } from '../acps';
import { ACP_REVOKER_ABI } from '../../acps/registry';
import type { ACP } from '../../acps/types';

const ISSUER = '0x1234567890123456789012345678901234567890';
const REVOKER = '0x00000000000000000000000000000000000000c0';
const TX_HASH = `0x${'ab'.repeat(32)}` as Hex;

// A wallet client with a JSON-RPC account and no `chain`, like the one HardhatSignerAdapter and the
// Hardhat 3 plugin build. It records what it is asked to send.
const walletWithoutChain = () => {
  const sent: { to: Hex; data: Hex }[] = [];
  const walletClient = createWalletClient({
    account: ISSUER,
    transport: custom({
      request: async ({ method, params }: { method: string; params?: any }) => {
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'eth_sendTransaction') {
          sent.push(params[0]);
          return TX_HASH;
        }
        throw new Error(`unexpected ${method}`);
      },
    }),
  });
  return { walletClient, sent };
};

const revocableACP = { issuer: ISSUER, revokerContract: REVOKER, revokerData: 42 } as unknown as ACP;

describe('revoking on a wallet client without a chain', () => {
  it('revokeACP sends revokeSingle', async () => {
    const { walletClient, sent } = walletWithoutChain();
    await expect(acps.revokeACP(revocableACP, walletClient)).resolves.toBe(TX_HASH);

    expect(sent[0].to).toBe(REVOKER);
    expect(decodeFunctionData({ abi: ACP_REVOKER_ABI, data: sent[0].data })).toEqual({
      functionName: 'revokeSingle',
      args: [42n],
    });
  });

  it('revokeAllACPs sends revokeAllExisting', async () => {
    const { walletClient, sent } = walletWithoutChain();
    await expect(acps.revokeAllACPs(walletClient, {} as PublicClient, REVOKER)).resolves.toBe(TX_HASH);

    expect(sent[0].to).toBe(REVOKER);
    expect(decodeFunctionData({ abi: ACP_REVOKER_ABI, data: sent[0].data }).functionName).toBe('revokeAllExisting');
  });
});
