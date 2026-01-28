import {
  useCofheEncrypt,
  type EncryptableArray,
  type EncryptedInputs,
  type EncryptionOptions,
  type UseCofheEncryptMutationOptions,
} from './useCofheEncryptOld';
import type { EncryptableItem } from '@cofhe/sdk';

import {
  useCofheWriteContract,
  type UseCofheWriteContractOptions,
  type WriteContractInputWithExtras,
} from './useCofheWriteContractOld';

export function useCofheEncryptAndWriteContract<TExtraVars, T extends EncryptableItem | EncryptableArray>({
  encryping = {},
  writingMutationOptions,
}: {
  encryping?: {
    options?: EncryptionOptions<T>;
    mutationOptions?: UseCofheEncryptMutationOptions<T>;
  };
  writingMutationOptions?: UseCofheWriteContractOptions<TExtraVars>;
}) {
  const encryption = useCofheEncrypt(encryping.options, encryping.mutationOptions);
  const write = useCofheWriteContract(writingMutationOptions);

  async function encryptAndWrite(
    encryptionOptions: EncryptionOptions<T>,
    constructWriteContractInputWithArgsWithExtras: (
      encryped: EncryptedInputs<T>
    ) => WriteContractInputWithExtras<TExtraVars>
  ) {
    const encrypted = await encryption.encrypt(encryptionOptions);
    const writeContractVariablesWithExtras = constructWriteContractInputWithArgsWithExtras(encrypted);
    // prop drill the extra vars (Token) so it's available in onSuccess
    return write.writeContractAsync(writeContractVariablesWithExtras);
  }

  return {
    encryption,
    write,
    encryptAndWrite,
  };
}
