import { type Address } from 'viem';
import type { Token } from './useCofheTokenLists.js';
import { TRANSFER_ABIS } from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { createEncryptable, type EncryptableItem } from '@cofhe/sdk';
import { useCofheEncryptAndWriteContract } from './useCofheEncryptAndWriteContract.js';
import type { UseCofheWriteContractOptions } from './useCofheWriteContract.js';
import type { EncryptionOptions } from './useCofheEncrypt.js';

type TokenTransferExtras = { token: Token; amount: bigint; userAddress: Address };
type UseCofheTokenTransferOptions = Pick<
  UseCofheWriteContractOptions<TokenTransferExtras>,
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
  const { encryption, write, encryptAndWrite } = useCofheEncryptAndWriteContract<TokenTransferExtras, EncryptableItem>({
    writingMutationOptions: {
      onSuccess: (hash, writeParams, result, context) => {
        if (passedOnSuccess) passedOnSuccess(hash, writeParams, result, context);

        // Record transaction and watch for confirmation
        useTransactionStore.getState().addTransaction({
          hash,
          token: writeParams.extras.token,
          tokenAmount: writeParams.extras.amount,
          chainId: writeParams.extras.token.chainId,
          actionType: TransactionActionType.ShieldSend,
          account: writeParams.extras.userAddress,
        });
      },
      ...restOfOptions,
    },
  });

  return {
    encryption,
    write,
    isPending: encryption.isEncrypting || write.isPending,
    data: write.data,
    encryptAmountAndSendToken: ({ input, encryptionOptions }: EncryptAndSendInput) => {
      const { token, to, amount, userAddress } = input;
      return encryptAndWrite(
        {
          input: createEncryptable(token.extensions.fhenix.confidentialValueType, amount),
          ...encryptionOptions,
        },
        (encrypted) => {
          const contractConfig = TRANSFER_ABIS[token.extensions.fhenix.confidentialityType];
          return {
            writeContractInput: {
              address: token.address,
              abi: contractConfig.abi,
              functionName: contractConfig.functionName,
              args: [to, encrypted],
              account: userAddress,
              chain: undefined,
            },
            extras: {
              token,
              amount,
              userAddress,
            },
          };
        }
      );
    },
  };
}
