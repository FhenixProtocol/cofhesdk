import { describe, it, expect, vi } from 'vitest';
import type { ethers } from 'ethers';
import { mock_expectPlaintext, mock_getPlaintext, mock_getPlaintextExists } from '../src/utils.js';

/**
 * Regression coverage for the mock_getPlaintext / mock_getPlaintextExists / mock_expectPlaintext
 * helpers, which are meant to no-op (with a console.log) when called against a network where the
 * CoFHE mock stack (MockZkVerifier / MockTaskManager) is not deployed -- e.g. a real testnet,
 * as opposed to the local Hardhat network used for unit testing FHE contracts.
 *
 * `mock_checkIsTestnet` (not exported) decides this by reading the bytecode at
 * MOCKS_ZK_VERIFIER_ADDRESS via `provider.getCode(...)`. Ethers (and the JSON-RPC `eth_getCode`
 * method it wraps) returns the *string* "0x" -- never a zero-length string -- when there is no
 * contract deployed at an address. A minimal fake provider is used here instead of a real
 * network connection so these tests exercise only that branching logic.
 */

/** A fake provider that only implements the one method these helpers call before branching. */
function fakeProviderWithCode(code: string): ethers.JsonRpcProvider {
  return {
    getCode: vi.fn().mockResolvedValue(code),
    // Intentionally no other methods: if the code under test fails to take the "skip" branch,
    // it will go on to build an ethers.Contract and invoke a read call, which needs provider
    // methods this fake does not provide -- surfacing as a clear failure below.
  } as unknown as ethers.JsonRpcProvider;
}

describe('mock plaintext helpers - non-mock network detection', () => {
  describe('when MockZkVerifier has no bytecode (real network, e.g. a live testnet)', () => {
    const provider = fakeProviderWithCode('0x');

    it('mock_getPlaintext resolves to undefined instead of attempting a contract call', async () => {
      await expect(mock_getPlaintext(provider, 123n)).resolves.toBeUndefined();
    });

    it('mock_getPlaintextExists resolves to undefined instead of attempting a contract call', async () => {
      await expect(mock_getPlaintextExists(provider, 123n)).resolves.toBeUndefined();
    });

    it('mock_expectPlaintext resolves without throwing instead of attempting a contract call', async () => {
      await expect(mock_expectPlaintext(provider, 123n, 7n)).resolves.toBeUndefined();
    });
  });

  describe('when MockZkVerifier has bytecode (local Hardhat mock network)', () => {
    it('mock_getPlaintext does not take the skip branch (attempts to read from the chain)', async () => {
      const provider = fakeProviderWithCode('0x6080604052348015600e575f80fd5b50');

      // The fake provider implements only getCode(), so proceeding past the (correct) "mock is
      // deployed, don't skip" branch must attempt further provider interaction and reject --
      // proving the function did NOT take the early-return / skip path in this case.
      await expect(mock_getPlaintext(provider, 123n)).rejects.toBeDefined();
    });
  });
});
