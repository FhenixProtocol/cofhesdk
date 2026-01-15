import {
  useCofheEncrypt,
  type EncryptableArray,
  type EncryptedInputs,
  type EncryptionOptions,
  type UseMutationOptionsAsync,
} from './useCofheEncrypt';
import type { EncryptableItem } from '@cofhe/sdk';

import {
  useCofheWriteContract,
  type UseCofheWriteContractOptions,
  type VariablesWithExtrasWithArgs,
} from './useCofheWriteContract';

export function useCofheEncryptAndWriteContract<TExtraVars, T extends EncryptableItem | EncryptableArray>({
  encryptionOptions,
  encryptionMutationOptions,
  writeMutationOptions,
}: {
  encryptionOptions?: EncryptionOptions<T>;
  encryptionMutationOptions?: UseMutationOptionsAsync<T>;
  writeMutationOptions: UseCofheWriteContractOptions<TExtraVars>;
}) {
  const encryption = useCofheEncrypt(encryptionOptions, encryptionMutationOptions);

  const writing = useCofheWriteContract(writeMutationOptions);

  return {
    encryption,
    writing,
    encryptAndWrite: async (
      encryptionOptions: EncryptionOptions<T>,
      writeContractVairiablesWithExtrasConstructor: (
        encryped: EncryptedInputs<T>
      ) => VariablesWithExtrasWithArgs<TExtraVars>
    ) => {
      const encrypted = await encryption.encrypt(encryptionOptions);

      const writeContractVariablesWithExtras = writeContractVairiablesWithExtrasConstructor(encrypted);

      const txHash = await writing.writeContractAsync(
        writeContractVariablesWithExtras // prop drill the extra vars (Token) so it's available in onSuccess
      );

      return {
        txHash,
      };
    },
  };
}
