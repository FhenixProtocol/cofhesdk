import { decodeFunctionResult, encodeFunctionData, type Abi, type Address, type PublicClient } from 'viem';

export type WaitUntilRpcAwareAndReadContractOptions = {
  pollingInterval?: number;
  signal?: AbortSignal;
};

function abortError(message = 'Aborted') {
  const err = new Error(message);
  (err as any).name = 'AbortError';
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
export async function waitUntilRpcAwareAndReadContract<TReturn = unknown>(
  publicClient: PublicClient,
  params: {
    receiptBlockHash: `0x${string}`;
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
  },
  options: WaitUntilRpcAwareAndReadContractOptions = {}
): Promise<TReturn> {
  const pollingInterval = options.pollingInterval ?? 1_000;

  console.log(`Waiting until RPC is aware of block ${params.receiptBlockHash} to read contract...`);
  let done = false;
  while (!done) {
    if (options.signal?.aborted) throw abortError();

    const callData = encodeFunctionData({
      abi: params.abi as any,
      functionName: params.functionName as any,
      args: params.args as any,
    });

    const [blockRes, callRes] = await Promise.allSettled([
      publicClient.request({
        method: 'eth_getBlockByHash',
        params: [params.receiptBlockHash, false],
      }),
      publicClient.call({
        to: params.address,
        data: callData,
      }),
    ]);

    const blockKnown = blockRes.status === 'fulfilled' && blockRes.value != null;

    const callDataResult = callRes.status === 'fulfilled' ? callRes.value?.data : undefined;
    const callOk = callDataResult !== undefined;

    if (blockKnown && callOk) {
      done = true;
      return decodeFunctionResult({
        abi: params.abi as any,
        functionName: params.functionName as any,
        data: callDataResult as `0x${string}`,
      }) as TReturn;
    }

    await sleep(pollingInterval, options.signal);
  }

  // Unreachable, but keeps TS happy.
  throw new Error('Unexpected exit from wait loop');
}
