/* eslint-disable no-unused-vars */

import { PermitUtils, type Permit } from '@/permits';

import { CofhesdkError, CofhesdkErrorCode } from '../error.js';
import { type Result, resultWrapper } from '../result.js';
import { type EncryptedItemInput } from '../types.js';
import { hardhat } from 'viem/chains';
import { BaseBuilder, type BaseBuilderParams } from '../baseBuilder.js';
import { permits } from '../permits.js';
import { MockAttesterAddress, MockAttesterAbi } from './MockAttesterAbi.js';

type AttestationBuilderParams = BaseBuilderParams & {};

enum AttestationFunction {
  gte = 'gte',
  lte = 'lte',
  lt = 'lt',
  gt = 'gt',
  eq = 'eq',
  ne = 'ne',
}

const AttestationFunctionId = {
  [AttestationFunction.gte]: 18,
  [AttestationFunction.lte]: 19,
  [AttestationFunction.lt]: 20,
  [AttestationFunction.gt]: 21,
  [AttestationFunction.eq]: 24,
  [AttestationFunction.ne]: 25,
} as const;

/**
 * Example:
 *
 * ```typescript
 * const encryptedInputResult = await cofheClient.encrypt([Encryptable.uint128(10n)]).encrypt();
 * const [encryptedInput] = encryptedInputResult.data;
 *
 * const proof = await cofheClient.createAttestationProof()
 *   .lhsPlaintext(10n)                 // or .lhsEncryptedInput(encryptedInput) or .lhsEncryptedValue(encryptedValue)
 *   .lte()                             // or .gte() / .lte() / .lt() / .gt() / .eq() / .ne() / .function(AttestationFunction)
 *   .rhsEncryptedInput(encryptedInput) // or .rhsPlaintext(rhs) or .rhsEncryptedValue(encryptedValue)
 *   .attest();                         // execute
 * ```
 *
 */
export class AttestationBuilder extends BaseBuilder {
  private lhs: bigint | undefined;
  private rhs: bigint | undefined;
  private functionId: AttestationFunction | undefined;

  constructor(params: AttestationBuilderParams) {
    super({
      config: params.config,
      publicClient: params.publicClient,
      walletClient: params.walletClient,
      chainId: params.chainId,
      account: params.account,
      requireConnected: params.requireConnected,
    });
  }


  setAccount(account: string): AttestationBuilder {
    this.account = account;
    return this;
  }

  getAccount(): string | undefined {
    return this.account;
  }

  setChainId(chainId: number): AttestationBuilder {
    this.chainId = chainId;
    return this;
  }

  getChainId(): number | undefined {
    return this.chainId;
  }

  lhsPlaintext(lhs: bigint): AttestationBuilder {
    this.lhs = lhs;
    return this;
  }

  lhsEncryptedInput(encryptedInput: EncryptedItemInput): AttestationBuilder {
    this.lhs = encryptedInput.ctHash;
    return this;
  }

  lhsEncryptedValue(encryptedValue: bigint): AttestationBuilder {
    this.lhs = encryptedValue;
    return this;
  }

  rhsPlaintext(rhs: bigint): AttestationBuilder {
    this.rhs = rhs;
    return this;
  }

  rhsEncryptedInput(encryptedInput: EncryptedItemInput): AttestationBuilder {
    this.rhs = encryptedInput.ctHash;
    return this;
  }

  rhsEncryptedValue(encryptedValue: bigint): AttestationBuilder {
    this.rhs = encryptedValue;
    return this;
  }

  function(functionId: AttestationFunction): AttestationBuilder {
    this.functionId = functionId;
    return this;
  }

  gte(): AttestationBuilder {
    this.functionId = AttestationFunction.gte;
    return this;
  }

  lte(): AttestationBuilder {
    this.functionId = AttestationFunction.lte;
    return this;
  }

  lt(): AttestationBuilder {
    this.functionId = AttestationFunction.lt;
    return this;
  }

  gt(): AttestationBuilder {
    this.functionId = AttestationFunction.gt;
    return this;
  }

  eq(): AttestationBuilder {
    this.functionId = AttestationFunction.eq;
    return this;
  }
  
  ne(): AttestationBuilder {
    this.functionId = AttestationFunction.ne;
    return this;
  }

  private async getResolvedPermit(): Promise<Permit> {
    const chainId = await this.getChainIdOrThrow();
    const account = await this.getAccountOrThrow();

    // Fetch with active permit
    const permit = await permits.getActivePermit(chainId, account);
    if (!permit) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.PermitNotFound,
        message: `Active permit not found for chainId <${chainId}> and account <${account}>`,
        hint: 'Ensure a permit exists for this account on this chain.',
        context: {
          chainId,
          account,
        },
      });
    }
    return permit;
  }

  private getLhsOrThrow(): bigint {
    if (!this.lhs) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.InternalError,
        message: 'Lhs is not set',
        hint: `Ensure lhsPlaintext, lhsEncryptedInput, or lhsEncryptedValue has been called.`,
      });
    }
    return this.lhs;
  }

  private getRhsOrThrow(): bigint {
    if (!this.rhs) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.InternalError,
        message: 'Rhs is not set',
        hint: `Ensure rhsPlaintext, rhsEncryptedInput, or rhsEncryptedValue has been called.`,
      });
    }
    return this.rhs;
  }

  private getFunctionIdOrThrow(): AttestationFunction {
    if (!this.functionId) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.InternalError,
        message: 'Function id is not set',
        hint: `Ensure function has been called.`,
      });
    }
    return this.functionId;
  }

  private async mocksAttest(): Promise<`0x${string}`> {
    const publicClient = this.getPublicClientOrThrow();
    const lhs = this.getLhsOrThrow();
    const rhs = this.getRhsOrThrow();
    const functionId = this.getFunctionIdOrThrow();

    const permit = await this.getResolvedPermit();
    const permission = PermitUtils.getPermission(permit, true);
    const permissionWithBigInts = {
      ...permission,
      expiration: BigInt(permission.expiration),
      validatorId: BigInt(permission.validatorId),
    };

    const [success, proof] = await publicClient.readContract({
      address: MockAttesterAddress,
      abi: MockAttesterAbi,
      functionName: 'attestEncryptedEncrypted',
      args: [lhs, rhs, AttestationFunctionId[functionId], permissionWithBigInts],
    });

    if (!success) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.InternalError,
        message: 'Attestation failed',
        hint: `Ensure you have permission for lhs and rhs (if encrypted inputs / values). Ensure that {lhs} {function} {rhs} is true. (ex 5 <= 10).`,
      });
    }

    return proof;
  }

  /**
   * In the production context, perform a true encryption with the CoFHE coprocessor.
   */
  private async productionAttest(): Promise<`0x${string}`> {
    return '0xNotImplemented';
  }

  async attest(): Promise<Result<`0x${string}`>> {
    return resultWrapper(async () => {
      // Ensure cofhe client is connected
      await this.requireConnectedOrThrow();

      const chainId = await this.getChainIdOrThrow();

      // On hardhat, interact with MockAttester contract instead of CoFHE
      if (chainId === hardhat.id) {
        return await this.mocksAttest();
      }

      return await this.productionAttest();
    });
  }
}
