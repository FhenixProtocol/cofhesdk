import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encodePacked, keccak256, zeroAddress, type Address, type PublicClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { verifyDecryptResult } from '../decrypt/verifyDecryptResult.js';
import { clearTaskManagerAddressCache } from '../taskManager.js';

const CHAIN_ID = 31337;
const TM = '0x0000000000000000000000000000000000005000';
// euint32 (utype 4) in the type byte
const CT_HASH = (0xabcdefn << 16n) | (4n << 8n);
const CLEARTEXT = 42n;

const signer = privateKeyToAccount(generatePrivateKey());

const signDecryptResult = (ctHash: bigint, cleartext: bigint) =>
  signer.sign({
    hash: keccak256(encodePacked(['uint256', 'uint32', 'uint64', 'uint256'], [cleartext, 4, BigInt(CHAIN_ID), ctHash])),
  });

const fakeClient = (decryptResultSigner: Address) =>
  ({
    chain: { id: CHAIN_ID },
    readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === 'getTm' ? TM : decryptResultSigner
    ),
  }) as unknown as PublicClient;

describe('verifyDecryptResult', () => {
  beforeEach(() => clearTaskManagerAddressCache());

  it('accepts a result signed by the configured decryptResultSigner', async () => {
    const signature = await signDecryptResult(CT_HASH, CLEARTEXT);

    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, signature, fakeClient(signer.address))).to.equal(true);
  });

  it('rejects a result signed by a different key', async () => {
    const signature = await signDecryptResult(CT_HASH, CLEARTEXT);
    const other = privateKeyToAccount(generatePrivateKey());

    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, signature, fakeClient(other.address))).to.equal(false);
  });

  it('fails closed when the decryptResultSigner is unset (zero address)', async () => {
    const signature = await signDecryptResult(CT_HASH, CLEARTEXT);

    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, signature, fakeClient(zeroAddress))).to.equal(false);
    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, '0x', fakeClient(zeroAddress))).to.equal(false);
  });
});
