import { describe, it, expect, vi } from 'vitest';
import { BaseError, ContractFunctionRevertedError, encodeErrorResult, type Hex, type PublicClient } from 'viem';
import { checkPermitValidityOnChain } from '../onchain-utils.js';
import { CofheError, CofheErrorCode } from '../../core/error.js';
import type { Permission } from '../types.js';

const ACL_ADDRESS = '0x1234567890123456789012345678901234567890' as Hex;

/** The subset of the ACL ABI that the SDK knows how to decode. */
const aclErrorsAbi = [
  { type: 'error', name: 'PermissionInvalid_Disabled', inputs: [] },
  { type: 'error', name: 'PermissionInvalid_Expired', inputs: [] },
  { type: 'error', name: 'PermissionInvalid_IssuerSignature', inputs: [] },
  { type: 'error', name: 'PermissionInvalid_RecipientSignature', inputs: [] },
] as const;

/** A custom error the SDK's ABI does not declare, so its revert data cannot be decoded. */
const unknownErrorAbi = [{ type: 'error', name: 'SomeErrorOutsideTheSdkAbi', inputs: [] }] as const;

const UNKNOWN_ERROR_DATA = encodeErrorResult({
  abi: unknownErrorAbi,
  errorName: 'SomeErrorOutsideTheSdkAbi',
});

const encodeAclError = (errorName: (typeof aclErrorsAbi)[number]['name']): Hex =>
  encodeErrorResult({ abi: aclErrorsAbi, errorName });

const permission: Permission = {
  issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  expiration: 1000000000000,
  recipient: '0x0000000000000000000000000000000000000000',
  validatorId: 0,
  validatorContract: '0x0000000000000000000000000000000000000000',
  sealingKey: `0x${'ab'.repeat(32)}`,
  issuerSignature: '0x',
  recipientSignature: '0x',
};

/**
 * A publicClient stub. `readContract` answers the `acl()` lookup, `simulateContract` decides
 * whether the permit check passes. Nothing here touches the network.
 */
const createPublicClient = (simulateContract: () => Promise<unknown>): PublicClient =>
  ({
    readContract: vi.fn().mockResolvedValue(ACL_ADDRESS),
    simulateContract: vi.fn().mockImplementation(simulateContract),
  }) as unknown as PublicClient;

const revertedWith = (data: Hex | undefined): ContractFunctionRevertedError =>
  new ContractFunctionRevertedError({
    abi: aclErrorsAbi as never,
    data,
    functionName: 'checkPermitValidity',
  });

/**
 * Wraps a revert error the way viem wraps one coming back from an RPC call. `details` is assigned
 * directly because viem populates it from the RPC payload, which we are not reconstructing here.
 */
const wrapRevert = (cause: BaseError, details?: string): BaseError => {
  const wrapped = new BaseError('The contract function "checkPermitValidity" reverted.', { cause });
  if (details != null) wrapped.details = details;
  return wrapped;
};

const rejectionOf = async (client: PublicClient): Promise<unknown> => {
  try {
    await checkPermitValidityOnChain(permission, client);
  } catch (err) {
    return err;
  }

  throw new Error('expected checkPermitValidityOnChain to reject, but it resolved');
};

describe('checkPermitValidityOnChain', () => {
  it('returns true when the ACL simulation succeeds', async () => {
    const client = createPublicClient(async () => ({ result: true }));

    await expect(checkPermitValidityOnChain(permission, client)).resolves.toBe(true);
    expect(client.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: ACL_ADDRESS, functionName: 'checkPermitValidity' })
    );
  });

  describe('when the revert reason is declared in the ABI', () => {
    it.each(aclErrorsAbi.map((item) => item.name))('reports %s as the error name', async (errorName) => {
      const original = wrapRevert(revertedWith(encodeAclError(errorName)));
      const client = createPublicClient(async () => {
        throw original;
      });

      const err = await rejectionOf(client);

      expect(err).toBeInstanceOf(CofheError);
      expect((err as CofheError).code).toBe(CofheErrorCode.PermitInvalid);
      expect((err as CofheError).context).toEqual({ errorName });
      expect((err as CofheError).message).toContain(errorName);
      expect((err as CofheError).cause).toBe(original);
    });
  });

  describe('when the revert reason is a custom error missing from the ABI', () => {
    it('rethrows the original error instead of an empty-message Error', async () => {
      const original = wrapRevert(revertedWith(UNKNOWN_ERROR_DATA));
      const client = createPublicClient(async () => {
        throw original;
      });

      const err = await rejectionOf(client);

      // The regression: `revertError.data` is undefined here, and the old code turned that into
      // `new Error('')`, discarding everything about the actual failure.
      expect(err).toBe(original);
      expect((err as Error).message).not.toBe('');
      expect((err as Error).message).toContain('checkPermitValidity');

      // The undecodable revert is still reachable from the thrown error.
      const revertError = (err as BaseError).walk((e) => e instanceof ContractFunctionRevertedError);
      expect(revertError).toBeInstanceOf(ContractFunctionRevertedError);
      expect((revertError as ContractFunctionRevertedError).data).toBeUndefined();
      expect((revertError as ContractFunctionRevertedError).raw).toBe(UNKNOWN_ERROR_DATA);
    });

    it('still falls back to the custom error name in the details field', async () => {
      const original = wrapRevert(
        revertedWith(UNKNOWN_ERROR_DATA),
        "VM Exception while processing transaction: reverted with custom error 'PermissionInvalid_Expired()'"
      );
      const client = createPublicClient(async () => {
        throw original;
      });

      const err = await rejectionOf(client);

      expect(err).toBeInstanceOf(CofheError);
      expect((err as CofheError).context).toEqual({ errorName: 'PermissionInvalid_Expired' });
      expect((err as CofheError).cause).toBe(original);
    });

    it('still falls back to decoding the return data in the details field', async () => {
      const original = wrapRevert(
        revertedWith(UNKNOWN_ERROR_DATA),
        `Error: Transaction reverted (return data: ${encodeAclError('PermissionInvalid_IssuerSignature')})`
      );
      const client = createPublicClient(async () => {
        throw original;
      });

      const err = await rejectionOf(client);

      expect(err).toBeInstanceOf(CofheError);
      expect((err as CofheError).context).toEqual({
        errorName: 'PermissionInvalid_IssuerSignature',
      });
      expect((err as CofheError).cause).toBe(original);
    });

    it('rethrows the original error when the return data does not decode either', async () => {
      const original = wrapRevert(
        revertedWith(undefined),
        `Error: Transaction reverted (return data: ${UNKNOWN_ERROR_DATA})`
      );
      const client = createPublicClient(async () => {
        throw original;
      });

      const err = await rejectionOf(client);

      expect(err).toBe(original);
      expect((err as Error).message).not.toBe('');
    });
  });

  it('rethrows non-revert failures untouched', async () => {
    const original = new Error('connection refused');
    const client = createPublicClient(async () => {
      throw original;
    });

    const err = await rejectionOf(client);

    expect(err).toBe(original);
  });
});
