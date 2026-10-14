import { cofheLogger } from './debug';
import type { PublicClient, TransactionReceipt } from 'viem';

const ZERO_BLOCK_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const RECEIPT_BLOCK_HASH_POLLING_INTERVAL_MS = 1_000;
const DEFAULT_MAX_WAIT_MS = 60_000;

function hasInvalidBlockHash(blockHash: TransactionReceipt['blockHash'] | undefined) {
  return blockHash === ZERO_BLOCK_HASH;
}

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

export type ResolveReceiptBlockHashOptions = {
  signal?: AbortSignal;
  /** Give up after this long (default 60s) — the loop must be bounded, not a permanent background poll. */
  maxWaitMs?: number;
  pollingIntervalMs?: number;
};

// Some RPCs can return a mined receipt whose blockHash is still the zero sentinel.
// We normalize that here, before writing the receipt into the transaction store,
// so downstream invalidation and lifecycle code can rely on a real block hash.
//
// The receipt is re-fetched BY TRANSACTION HASH, not by block height: under a
// reorg, `getBlock({ blockNumber })` hands back whichever block now occupies
// that height — quietly reintroducing the number-based ambiguity that hash
// gating exists to avoid. The tx hash always names this transaction's current
// canonical block.
export async function resolveReceiptBlockHash(
  receipt: TransactionReceipt,
  publicClient: PublicClient,
  options: ResolveReceiptBlockHashOptions = {}
): Promise<TransactionReceipt> {
  if (!hasInvalidBlockHash(receipt.blockHash)) return receipt;
  if (receipt.blockNumber === null) return receipt;

  const {
    signal,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    pollingIntervalMs = RECEIPT_BLOCK_HASH_POLLING_INTERVAL_MS,
  } = options;
  const startedAt = Date.now();

  cofheLogger.warn('Mined receipt returned invalid zero blockHash; retrying until a real block hash is available', {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  });

  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw abortError();
    attempt += 1;

    try {
      const fresh = await publicClient.getTransactionReceipt({
        hash: receipt.transactionHash,
      });

      if (fresh.blockHash && !hasInvalidBlockHash(fresh.blockHash)) {
        cofheLogger.log('Resolved real blockHash for mined receipt after retry', {
          txHash: receipt.transactionHash,
          blockNumber: fresh.blockNumber,
          attempts: attempt,
          blockHash: fresh.blockHash,
        });

        // Return the re-fetched receipt wholesale: under a reorg the tx may sit
        // in a different block than the original receipt claimed.
        return fresh;
      }

      cofheLogger.debug('Receipt blockHash still unavailable; retrying receipt lookup', {
        txHash: receipt.transactionHash,
        attempts: attempt,
        blockHash: fresh.blockHash,
      });
    } catch (error) {
      cofheLogger.warn('Failed to normalize mined receipt blockHash from txHash; retrying', {
        txHash: receipt.transactionHash,
        attempts: attempt,
        error,
      });
    }

    if (Date.now() - startedAt >= maxWaitMs) {
      throw new Error(
        `resolveReceiptBlockHash: gave up after ${maxWaitMs}ms (${attempt} attempts) — receipt for ${receipt.transactionHash} never carried a real blockHash`
      );
    }

    await sleep(pollingIntervalMs, signal);
  }
}
