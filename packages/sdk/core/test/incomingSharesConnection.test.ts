import { describe, expect, it } from 'vitest';
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  type Hex,
} from 'viem';
import { createCofheClientBase } from '../client';
import { createCofheConfigBase } from '../config';
import { ACP_SHARE_REGISTRY_ABI } from '../../acps/registry';
import { CofheErrorCode } from '../error';

const ACCOUNT = getAddress('0x00000000000000000000000000000000000000a1');
const OTHER_ACCOUNT = getAddress('0x00000000000000000000000000000000000000b1');
const REGISTRY = '0x00000000000000000000000000000000000000e0';
const CHAIN_ID = 11155111;

function fixture(hoisted = false) {
  let selectedAccount: Hex = ACCOUNT;
  const recipients: unknown[] = [];
  const transport = custom({
    request: async ({ method, params }) => {
      if (method === 'eth_chainId') return '0xaa36a7';
      if (method === 'eth_accounts') return [selectedAccount];
      if (method === 'eth_call') {
        const [{ data }] = params as [{ data: Hex }];
        const call = decodeFunctionData({ abi: ACP_SHARE_REGISTRY_ABI, data });
        expect(call.functionName).toBe('sharesFor');
        recipients.push(call.args?.[0]);
        return encodeFunctionResult({ abi: ACP_SHARE_REGISTRY_ABI, functionName: 'sharesFor', result: [[], []] });
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    },
  });
  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, ...(hoisted ? { account: ACCOUNT } : {}) });
  const unused = () => {
    throw new Error('Share listing does not use FHE encryption');
  };
  const client = createCofheClientBase({
    config: createCofheConfigBase({
      supportedChains: [],
      fheKeyStorage: null,
      acp: { sharingRegistry: { [CHAIN_ID]: REGISTRY } },
    }),
    initTfhe: async () => false,
    tfhePublicKeyDeserializer: unused,
    compactPkeCrsDeserializer: unused,
    zkBuilderAndCrsGenerator: unused,
  });
  return {
    client,
    publicClient,
    walletClient,
    recipients,
    selectOtherAccount: () => {
      selectedAccount = OTHER_ACCOUNT;
    },
  };
}

describe('incoming shares through the connected client', () => {
  it.each([false, true])('lists the connected account shares with a hoisted wallet account: %s', async (hoisted) => {
    const { client, publicClient, walletClient, recipients } = fixture(hoisted);
    await client.connect(publicClient, walletClient);
    expect(client.connection.account).toBe(ACCOUNT);
    await expect(client.acp.getIncomingShares()).resolves.toEqual([]);
    expect(recipients).toEqual([ACCOUNT]);
  });

  it('uses the new connected account after reconnecting an unhoisted wallet', async () => {
    const { client, publicClient, walletClient, recipients, selectOtherAccount } = fixture();
    await client.connect(publicClient, walletClient);
    await client.acp.getIncomingShares();
    client.disconnect();
    selectOtherAccount();
    await client.connect(publicClient, walletClient);
    await client.acp.getIncomingShares();
    expect(recipients).toEqual([ACCOUNT, OTHER_ACCOUNT]);
    expect(walletClient.account).toBeUndefined();
  });

  it('still requires a connection before reading the registry', async () => {
    const { client, recipients } = fixture();
    await expect(client.acp.getIncomingShares()).rejects.toMatchObject({ code: CofheErrorCode.NotConnected });
    expect(recipients).toEqual([]);
  });
});
