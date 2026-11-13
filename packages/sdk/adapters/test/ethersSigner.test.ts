import { NonceManager, JsonRpcProvider, Wallet as Wallet6 } from 'ethers6';
import { providers, VoidSigner, Wallet as Wallet5 } from 'ethers5';
import { getAddress, verifyMessage, verifyTypedData, type SignableMessage } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { Ethers5Adapter } from '../ethers5';
import { Ethers6Adapter } from '../ethers6';

// Represents a hardware/remote signer: it can sign, but exposes no privateKey.
class OpaqueSigner5 extends VoidSigner {
  constructor(private readonly wallet: Wallet5) {
    super(wallet.address);
  }

  override signMessage(message: string | Uint8Array) {
    return this.wallet.signMessage(message);
  }

  override _signTypedData(...args: Parameters<Wallet5['_signTypedData']>) {
    return this.wallet._signTypedData(...args);
  }
}

async function fixture(version: 5 | 6, local = false) {
  const send = vi.fn(async (method: string) => {
    if (method === 'eth_chainId') return '0x1';
    throw Object.assign(new Error(`Read-only RPC does not support ${method}`), { code: -32601 });
  });
  if (version === 6) {
    const provider = new JsonRpcProvider();
    provider.send = send;
    const wallet = Wallet6.createRandom();
    const signer = local ? wallet : new NonceManager(wallet);
    const result = await Ethers6Adapter(provider, signer);
    return { ...result, address: getAddress(wallet.address), send };
  }
  const provider = new providers.JsonRpcProvider();
  provider.send = send;
  const wallet = Wallet5.createRandom();
  const signer = local ? wallet : new OpaqueSigner5(wallet);
  const result = await Ethers5Adapter(provider, signer);
  return { ...result, address: getAddress(wallet.address), send };
}

const typedData = {
  domain: {
    name: 'Share',
    version: '1',
    chainId: 1n,
    verifyingContract: '0x0000000000000000000000000000000000000001',
  },
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Share: [{ name: 'amount', type: 'uint256' }],
  },
  primaryType: 'Share',
  message: { amount: 2n ** 128n },
} as const;

describe.each([5, 6] as const)('ethers %s opaque signers', (version) => {
  it('signs EIP-712 data through the supplied signer instead of a read-only RPC', async () => {
    const { walletClient, publicClient, address, send } = await fixture(version);
    const signature = await walletClient.signTypedData({ ...typedData, account: walletClient.account! });
    expect(await verifyTypedData({ ...typedData, address, signature })).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(await publicClient.getChainId()).toBe(1);
    expect(send).toHaveBeenCalledWith('eth_chainId', []);
  });

  it('also signs typed data without an explicit domain type', async () => {
    const { walletClient, address, send } = await fixture(version);
    const data = { ...typedData, types: { Share: typedData.types.Share } };
    const signature = await walletClient.signTypedData({ ...data, account: walletClient.account! });
    expect(await verifyTypedData({ ...data, address, signature })).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it.each<SignableMessage>(['0x6869', { raw: '0x6869' }, { raw: new Uint8Array([104, 105]) }])(
    'preserves text and raw bytes when signing %j',
    async (message) => {
      const { walletClient, address, send } = await fixture(version);
      const signature = await walletClient.signMessage({ message, account: walletClient.account! });
      expect(await verifyMessage({ address, message, signature })).toBe(true);
      expect(send).not.toHaveBeenCalled();
    }
  );

  it('does not sign a request for a different account', async () => {
    const { walletClient } = await fixture(version);
    await expect(
      walletClient.signTypedData({ ...typedData, account: '0x0000000000000000000000000000000000000002' })
    ).rejects.toThrow();
  });

  it('keeps private-key wallets signing locally', async () => {
    const { walletClient, address, send } = await fixture(version, true);
    const signature = await walletClient.signTypedData({ ...typedData, account: walletClient.account! });
    expect(await verifyTypedData({ ...typedData, address, signature })).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
});
