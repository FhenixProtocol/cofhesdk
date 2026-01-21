import {
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type ContractFunctionReturnType,
  type PublicClient,
} from 'viem';

export type WaitUntilRpcAwareAndReadContractOptions = {
  pollingInterval?: number;
  signal?: AbortSignal;
};

function abortError(message = 'Aborted') {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
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
): Promise<
  ContractFunctionReturnType<
    TAbi,
    'pure' | 'view',
    TfunctionName,
    ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>
  >
> {
  // if no blockHash given to be aware of, just read directly
  if (!params.blockHashToBeAwareOf)
    return publicClient.readContract({
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    });

  const pollingInterval = options.pollingInterval ?? 1_000;

  console.log(`Waiting until RPC is aware of block ${params.blockHashToBeAwareOf} to read contract...`);
  let done = false;
  while (!done) {
    if (options.signal?.aborted) throw abortError();

    const [blockRes, readRes] = await Promise.allSettled([
      publicClient.request({
        method: 'eth_getBlockByHash',
        params: [params.blockHashToBeAwareOf, false],
      }),
      publicClient.readContract({
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
      }),
    ]);

    const blockKnown = blockRes.status === 'fulfilled' && blockRes.value != null;

    if (blockKnown && readRes.status === 'fulfilled') {
      done = true;
      return readRes.value;
    }

    await sleep(pollingInterval, options.signal);
  }

  // Unreachable, but keeps TS happy.
  throw new Error('Unexpected exit from wait loop');
}
