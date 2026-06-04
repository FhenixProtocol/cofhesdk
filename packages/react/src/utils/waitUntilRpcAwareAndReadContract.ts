import {
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type ContractFunctionReturnType,
  type PublicClient,
} from 'viem';
import { cofheLogger } from './debug';

export type WaitUntilRpcAwareAndReadContractOptions = {
  onSuccess?: () => void;
  pollingInterval?: number;
  signal?: AbortSignal;
};

function abortError(message = 'Aborted') {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

export async function maybeWaitUntilRpcAware<T>(
  publicClient: PublicClient,
  params: {
    blockHashToBeAwareOf?: `0x${string}`;
    read: () => Promise<T>;
    readDescription?: string;
  },
  options: WaitUntilRpcAwareAndReadContractOptions = {}
): Promise<T> {
  if (!params.blockHashToBeAwareOf) return params.read();

  const pollingInterval = options.pollingInterval ?? 1_000;
  const readDescription = params.readDescription ?? 'RPC read';

  cofheLogger.log(
    `[maybeWaitUntilRpcAware]: Waiting until RPC is aware of block ${params.blockHashToBeAwareOf} before ${readDescription}...`
  );

  while (true) {
    if (options.signal?.aborted) throw abortError();

    const [blockRes, readRes] = await Promise.allSettled([
      publicClient.request({
        method: 'eth_getBlockByHash',
        params: [params.blockHashToBeAwareOf, false],
      }),
      params.read(),
    ]);

    const blockKnown = blockRes.status === 'fulfilled' && blockRes.value != null;

    if (blockKnown && readRes.status === 'fulfilled') {
      options.onSuccess?.();

      cofheLogger.debug(
        `[maybeWaitUntilRpcAware]: RPC is now aware of block ${params.blockHashToBeAwareOf}. Block fetch result:`,
        blockRes,
        'Read result:',
        readRes
      );
      return readRes.value;
    }

    cofheLogger.debug(
      `[maybeWaitUntilRpcAware]: RPC not yet aware of block ${params.blockHashToBeAwareOf}. Block fetch result:`,
      blockRes,
      'Read result:',
      readRes
    );

    await sleep(pollingInterval, options.signal);
  }
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;
  if (signal?.aborted) throw abortError();

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(abortError());
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Waits until an RPC node is aware of a specific `blockHash`, then performs the
 * contract read.
 *
 * Implementation detail: the function issues two RPC calls concurrently:
 * - `eth_getBlockByHash(blockHash)` to confirm the node has the block
 * - `eth_call` (via `publicClient.call`) for the actual contract read
 *
 * If your viem client transport has batching enabled, these concurrent calls are
 * typically sent as a single JSON-RPC batch — which is important when your RPC
 * provider load-balances across nodes.
 */
export type ReadContractResult<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
> = ContractFunctionReturnType<
  TAbi,
  'pure' | 'view',
  TfunctionName,
  ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>
>;
export async function maybeWaitUntilRpcAwareAndReadContract<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
>(
  publicClient: PublicClient,
  params: {
    blockHashToBeAwareOf?: `0x${string}`;
    address: Address;
    abi: TAbi;
    functionName: TfunctionName;
    args: ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>;
  },
  options: WaitUntilRpcAwareAndReadContractOptions = {}
): Promise<ReadContractResult<TAbi, TfunctionName>> {
  return maybeWaitUntilRpcAware(
    publicClient,
    {
      blockHashToBeAwareOf: params.blockHashToBeAwareOf,
      readDescription: `read contract ${params.functionName}`,
      read: () =>
        publicClient.readContract({
          address: params.address,
          abi: params.abi,
          functionName: params.functionName,
          args: params.args,
        }),
    },
    options
  );
}
