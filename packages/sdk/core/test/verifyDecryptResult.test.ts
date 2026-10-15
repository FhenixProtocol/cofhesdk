import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  concat,
  encodePacked,
  hexToBigInt,
  hexToNumber,
  keccak256,
  numberToHex,
  slice,
  zeroAddress,
  type Address,
  type PublicClient,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { verifyDecryptResult } from '../decrypt/verifyDecryptResult.js';
import { clearTaskManagerAddressCache } from '../taskManager.js';

const CHAIN_ID = 31337;
const TM = '0x0000000000000000000000000000000000005000';
// euint32 (utype 4) in the type byte
const CT_HASH = (0xabcdefn << 16n) | (4n << 8n);
const CLEARTEXT = 42n;
// secp256k1 curve order
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

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

  // The TaskManager checks the signature with OpenZeppelin's ECDSA.tryRecover, which only accepts
  // 65 bytes with v = 27 or 28 and s in the lower half of the curve order.
  it('rejects the signer signature with v = 0 or 1', async () => {
    const signature = await signDecryptResult(CT_HASH, CLEARTEXT);
    const v = hexToNumber(slice(signature, 64));
    const withYParity = concat([slice(signature, 0, 64), numberToHex(v - 27, { size: 1 })]);

    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, withYParity, fakeClient(signer.address))).to.equal(false);
  });

  it('rejects the signer signature with a high s value', async () => {
    const signature = await signDecryptResult(CT_HASH, CLEARTEXT);
    const s = hexToBigInt(slice(signature, 32, 64));
    const v = hexToNumber(slice(signature, 64));
    const highS = concat([
      slice(signature, 0, 32),
      numberToHex(SECP256K1_N - s, { size: 32 }),
      numberToHex(v === 27 ? 28 : 27, { size: 1 }),
    ]);

    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, highS, fakeClient(signer.address))).to.equal(false);
  });

  it('returns false for a malformed signature', async () => {
    const client = fakeClient(signer.address);

    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, '0x1234', client)).to.equal(false);
    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, `0x${'zz'.repeat(65)}`, client)).to.equal(false);
  });

  it('fails closed when the decryptResultSigner is unset (zero address)', async () => {
    const signature = await signDecryptResult(CT_HASH, CLEARTEXT);

    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, signature, fakeClient(zeroAddress))).to.equal(false);
    expect(await verifyDecryptResult(CT_HASH, CLEARTEXT, '0x', fakeClient(zeroAddress))).to.equal(false);
  });
});
