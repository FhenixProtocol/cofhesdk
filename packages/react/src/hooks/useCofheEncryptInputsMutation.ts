import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { type EncryptableItem, type EncryptedItemInput } from '@cofhe/sdk';
import { assert } from 'ts-essentials';
import { useInternalMutation } from '../providers/index.js';
import { useCofheContext } from '../providers/index.js';

export type UseCofheEncryptInputsMutationOptions = Omit<
  UseMutationOptions<readonly EncryptedItemInput[], Error, EncryptableItem[], unknown>,
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
  EncryptableItem[],
  unknown
> & {
  encryptInputsAsync: (items: EncryptableItem[]) => Promise<readonly EncryptedItemInput[]>;
  encryptInputs: (items: EncryptableItem[]) => void;
} {
  const client = useCofheContext().client;

  const mutation = useInternalMutation<readonly EncryptedItemInput[], Error, EncryptableItem[], unknown>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'encryptInputs'],
    mutationFn: async (items) => {
      assert(client, 'CoFHE client not initialized');
      return client.encryptInputs(items).encrypt();
    },
  });

  return {
    ...mutation,
    encryptInputsAsync: mutation.mutateAsync,
    encryptInputs: mutation.mutate,
  };
}
