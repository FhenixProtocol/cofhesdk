import { type Address } from 'viem';
import type { Token } from './useCofheTokenLists.js';
import { TRANSFER_ABIS } from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { createEncryptable, type EncryptableItem } from '@cofhe/sdk';
import { useCofheEncryptAndWriteContractNew } from './useCofheEncryptAndWriteContractNew.js';
import type { useCofheWriteContractNewOptions } from './useCofheWriteContractNew.js';
import type { EncryptionOptions } from './useCofheEncryptOld.js';

type TokenTransferExtras = { token: Token; amount: bigint; userAddress: Address };
type UseCofheTokenTransferOptions = Pick<
  useCofheWriteContractNewOptions<TokenTransferExtras>,
  'onSuccess' | 'onError' | 'onMutate'
>;

type EncryptAndSendInput = {
  input: {
    token: Token;
    to: Address;
    amount: bigint;
    userAddress: Address;
  };
  encryptionOptions?: EncryptionOptions<EncryptableItem>;
};

export function useCofheTokenTransfer(writeMutationOptions?: UseCofheTokenTransferOptions) {
  const { onSuccess: passedOnSuccess, ...restOfOptions } = writeMutationOptions || {};
  const { encryption, write, encryptAndWrite } = useCofheEncryptAndWriteContractNew<TokenTransferExtras>({
    writingMutationOptions: {
      onSuccess: (hash, variables, onMutateResult, context) => {
        if (passedOnSuccess) passedOnSuccess(hash, variables, onMutateResult, context);

        const extras =
          typeof variables === 'object' && variables !== null && 'extras' in variables ? variables.extras : null;

        if (!extras) return;

        // Record transaction and watch for confirmation
        useTransactionStore.getState().addTransaction({
          hash,
          token: extras.token,
          tokenAmount: extras.amount,
          chainId: extras.token.chainId,
          actionType: TransactionActionType.ShieldSend,
          isPendingDecryption: false, // doesn't need decryption afterwards
          account: extras.userAddress,
        });
      },
      ...restOfOptions,
    },
  });

  return {
    encryption,
    write,
    isPending: encryption.isPending || write.isPending,
    data: write.data,
    encryptAmountAndSendToken: ({ input, encryptionOptions }: EncryptAndSendInput) => {
      const { token, to, amount, userAddress } = input;

      const { input: _ignoredInput, ...encryptionOpts } = encryptionOptions ?? {};
      const contractConfig = TRANSFER_ABIS[token.extensions.fhenix.confidentialityType];

      return encryptAndWrite({
        params: {
          address: token.address,
          abi: contractConfig.abi,
          functionName: contractConfig.functionName,
          account: userAddress,
          chain: undefined,
        },
        confidentialityAwareAbiArgs: [to, amount] as const,
        extras: {
          token,
          amount,
          userAddress,
        },
        encryptionOptions: encryptionOpts,
      });
    },
  };
}
