import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import {
  assertCorrectEncryptedItemInput,
  type EncryptableItem,
  type EncryptedItemInput,
  type EncryptedItemInputs,
} from '@cofhe/sdk';
import { assert } from 'ts-essentials';
import { useInternalMutation } from '../providers/index.js';
import { useCofheContext } from '../providers/index.js';

type EncryptInputsResult<T extends readonly EncryptableItem[]> = EncryptedItemInputs<[...T]>;

function assertEncryptInputsResult<T extends readonly EncryptableItem[]>(
  inputs: T,
  encrypted: readonly EncryptedItemInput[]
): asserts encrypted is EncryptInputsResult<T> {
  if (encrypted.length !== inputs.length) {
    throw new Error(`Encryption result length mismatch (expected ${inputs.length}, got ${encrypted.length})`);
  }

  for (let i = 0; i < encrypted.length; i++) {
    const encryptedItem = encrypted[i];
    const inputItem = inputs[i];

    assertCorrectEncryptedItemInput(encryptedItem);

    if (encryptedItem.utype !== inputItem.utype) {
      throw new Error(`Encryption result type mismatch at index ${i}`);
    }
  }
}

export type UseCofheEncryptInputsMutationOptions = Omit<
  UseMutationOptions<readonly EncryptedItemInput[], Error, readonly EncryptableItem[], void>,
  'mutationFn'
>;

/**
 * Low-level mutation hook: encrypt a list of EncryptableItems into encrypted input structs.
 *
 * This is intentionally minimal (no step tracking UI state). For richer UX, use `useCofheEncrypt`.
 */
export function useCofheEncryptInputsMutation(options?: UseCofheEncryptInputsMutationOptions): UseMutationResult<
  readonly EncryptedItemInput[],
  Error,
  readonly EncryptableItem[],
  void
> & {
  encryptInputsAsync: <const T extends readonly EncryptableItem[]>(items: T) => Promise<EncryptInputsResult<T>>;
  encryptInputs: (items: readonly EncryptableItem[]) => void;
} {
  const client = useCofheContext().client;

  const mutation = useInternalMutation<readonly EncryptedItemInput[], Error, readonly EncryptableItem[], void>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'encryptInputs'],
    mutationFn: async (items) => {
      assert(client, 'CoFHE client not initialized');
      // SDK expects a mutable array type; copy preserves runtime value while satisfying typing.
      const mutableItems = Array.from(items);
      return client.encryptInputs(mutableItems).encrypt();
    },
  });

  return {
    ...mutation,
    encryptInputsAsync: async <const T extends readonly EncryptableItem[]>(items: T) => {
      const result = await mutation.mutateAsync(items);
      assertEncryptInputsResult(items, result);
      return result;
    },
    encryptInputs: (items) => mutation.mutate(items),
  };
}
