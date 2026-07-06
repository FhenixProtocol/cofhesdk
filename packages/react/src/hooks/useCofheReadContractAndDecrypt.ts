import { useEffect, useRef } from 'react';
import { cofheLogger } from '@/utils/debug';
import { useInternalQueryClient } from '@/providers';
import type { CofheFirstReturnFheType, CofheReturnType, EncryptedReturnTypeByUtype } from '@cofhe/abi';
import { FheTypes, type DecryptPollCallbackContext, type UnsealedItem } from '@cofhe/sdk';
import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Abi, type Address, type ContractFunctionArgs, type ContractFunctionName } from 'viem';
import { useCofheDecrypt } from './useCofheDecrypt';
import {
  useCofheReadContract,
  type UseCofheReadContractQueryOptions,
  type UseCofheReadContractResult,
} from './useCofheReadContract';
import type { CofheDecryptMeta } from '@/meta';

type SupportedFheTypeFromReturn<TAbi extends Abi, TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>> =
  CofheFirstReturnFheType<TAbi, TfunctionName> extends FheTypes
    ? CofheFirstReturnFheType<TAbi, TfunctionName>
    : FheTypes;

function isEncryptedValue<TFheType extends FheTypes>(value: unknown): value is EncryptedReturnTypeByUtype<TFheType> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ctHash' in value &&
    'utype' in value &&
    Object.values<unknown>(FheTypes).includes(value.utype)
  );
}

function convertCofheReturnTypeToEncryptedReturnType<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TFheType extends FheTypes,
>(value: CofheReturnType<TAbi, TfunctionName>): EncryptedReturnTypeByUtype<TFheType> {
  if (isEncryptedValue<TFheType>(value)) return value;

  // TODO: convertCofheReturnTypeToEncryptedReturnType -- support for mixed return types (e.g., structs with both encrypted and plain values)
  throw new Error(
    'Auto-decryption now only supports a case where the contract function returns a single encrypted value'
  );
}

const onPoll = (context: DecryptPollCallbackContext) => {
  cofheLogger.debug(
    `Decryption poll attemptIndex ${context.attemptIndex}. Operation: ${context.operation}. ${context.elapsedMs}ms elapsed. Request ID: ${context.requestId}.`
  );
};
/**
 * Generic hook: read a confidential contract value and decrypt it.
 */
// TODO: useCofheReadContractAndDecrypt only works for a scenario when the contract function returns a signle plain encrypted value (i.e. not struct etc)
export function useCofheReadContractAndDecrypt<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TFheType extends FheTypes = SupportedFheTypeFromReturn<TAbi, TfunctionName>,
  TDecryptedSelectedData = UnsealedItem<TFheType>,
>(
  params: {
    address?: Address;
    abi?: TAbi;
    functionName?: TfunctionName;
    args?: ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>;
    requiresPermit?: boolean;
  },

  {
    readQueryOptions,
    decryptingQueryOptions,
    meta,
  }: {
    readQueryOptions?: UseCofheReadContractQueryOptions<TAbi, TfunctionName>;
    decryptingQueryOptions?: Omit<
      UseQueryOptions<UnsealedItem<TFheType>, Error, TDecryptedSelectedData>,
      'queryKey' | 'queryFn'
    >;
    /** Consumer metadata for debug/activity views, attached to the decrypt stage. */
    meta?: CofheDecryptMeta;
  } = {}
): {
  encrypted: UseCofheReadContractResult<TAbi, TfunctionName>;
  decrypted: UseQueryResult<TDecryptedSelectedData, Error>;
  disabledDueToMissingValidPermit: boolean;
  /** The read's latest outcome is an error (its cached ctHash, if any, is stale). */
  isReadError: boolean;
  /** A value is present but the read that produced it is currently failing. */
  isValueStale: boolean;
  /** The read succeeded and the handle is 0 — a *known zero* value, with no ciphertext to decrypt. */
  isKnownZero: boolean;
} {
  const { address, abi, functionName, args, requiresPermit = true } = params;
  const queryClient = useInternalQueryClient();

  const encrypted = useCofheReadContract({ address, abi, functionName, args, requiresPermit }, readQueryOptions);

  const encryptedData = encrypted.data;

  // Couple the decrypt to the read's CURRENT outcome. react-query keeps the last
  // successful `data` after a later refetch fails, so feeding `data` unconditionally
  // would decrypt a stale ctHash and mask the fetch failure. `errorUpdatedAt >
  // dataUpdatedAt` unambiguously means "the latest read attempt errored" regardless
  // of how react-query reports `status` when data is still present.
  const isReadError = encrypted.errorUpdatedAt > encrypted.dataUpdatedAt;
  const isValueStale = isReadError && encryptedData != null;

  const asEncryptedReturnType =
    encryptedData && !isReadError
      ? convertCofheReturnTypeToEncryptedReturnType<TAbi, TfunctionName, TFheType>(encryptedData)
      : undefined;

  const currentCtHash = asEncryptedReturnType?.ctHash?.toString();
  const currentUtype = asEncryptedReturnType?.utype;

  // A read that succeeds with a 0 handle is a known zero — there is no ciphertext, so the decrypt
  // query stays disabled (see useCofheDecrypt) and never yields a value. Surface it explicitly so
  // callers render a clear `0` instead of mistaking the absent value for a fault.
  const isKnownZero = asEncryptedReturnType != null && BigInt(asEncryptedReturnType.ctHash) === 0n;

  // Evict a superseded decrypt (a ctHash that is no longer the active input, e.g.
  // because the read now errors or produced a different handle) so it can't linger
  // in the cache as a phantom "fetched → …" entry disagreeing with the live read.
  const prevRef = useRef<{ ctHash: string; utype: FheTypes } | undefined>(undefined);
  useEffect(() => {
    const prev = prevRef.current;
    if (prev && prev.ctHash !== currentCtHash) {
      queryClient.removeQueries({ queryKey: ['decryptCiphertext', prev.ctHash, prev.utype], exact: true });
    }
    prevRef.current =
      currentCtHash !== undefined && currentUtype !== undefined
        ? { ctHash: currentCtHash, utype: currentUtype }
        : undefined;
  }, [currentCtHash, currentUtype, queryClient]);

  const decrypted = useCofheDecrypt(
    {
      input: asEncryptedReturnType,
      onPoll,
      meta,
      // Carry the source contract + method onto the decrypt so its card is
      // recognizable without a separate ctHash→address registry.
      context: { address, functionName },
    },
    decryptingQueryOptions
  );

  return {
    encrypted,
    decrypted,
    disabledDueToMissingValidPermit: encrypted.disabledDueToMissingValidPermit,
    isReadError,
    isValueStale,
    isKnownZero,
  };
}
