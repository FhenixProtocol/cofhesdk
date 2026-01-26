import { type QueryKey } from '@tanstack/react-query';
import { type Abi, type Address, type ContractFunctionArgs, type ContractFunctionName, type PublicClient } from 'viem';
import { useScheduledInvalidationsStore } from '@/stores/scheduledInvalidationsStore.js';
import {
  maybeWaitUntilRpcAwareAndReadContract,
  type ReadContractResult,
  type WaitUntilRpcAwareAndReadContractOptions,
} from '../utils/waitUntilRpcAwareAndReadContract.js';

export const BLOCK_AWARENESS_POLLING_INTERVAL = 3_000; // 5 seconds

type Input<TAbi extends Abi, TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>> = {
  publicClient: PublicClient;
  queryKey: QueryKey;
  signal: AbortSignal;
  readContractParams: {
    address: Address;
    abi: TAbi;
    functionName: TfunctionName;
    args: ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>;
  };
};
export function decryptionAwareReadContract<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
>({
  publicClient,
  queryKey,
  signal,
  readContractParams,
}: Input<TAbi, TfunctionName>): Promise<ReadContractResult<TAbi, TfunctionName>> {
  const scheduledInvalidationsState = useScheduledInvalidationsStore.getState();

  // if there was a tx previously, which caused the need to invalidae this query upon decryption observation,
  // and if decryption has been observed for it, use the block hash to ensure RPC is aware of it
  // so that readContract can read up-to-date data
  const blockHashToBeAwareOf =
    scheduledInvalidationsState.findObservedDecryption(queryKey)?.decryptionObservedAt?.blockHash;

  console.log('Tracked decryption block for unshield claims:', blockHashToBeAwareOf);

  const rpcAwarenessOptions: WaitUntilRpcAwareAndReadContractOptions = {
    signal,
    pollingInterval: BLOCK_AWARENESS_POLLING_INTERVAL,
    onSuccess: () => {
      // once we have successfully read decrypted data, remove the invalidation tracking
      scheduledInvalidationsState.removeQueryKeyFromInvalidations(queryKey);
    },
  };

  return maybeWaitUntilRpcAwareAndReadContract(
    publicClient,
    {
      blockHashToBeAwareOf,
      ...readContractParams,
    },
    rpcAwarenessOptions
  );
}
