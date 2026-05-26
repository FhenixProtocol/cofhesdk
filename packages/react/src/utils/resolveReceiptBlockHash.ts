import { cofheLogger } from './debug';
import type { PublicClient, TransactionReceipt } from 'viem';

const ZERO_BLOCK_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const RECEIPT_BLOCK_HASH_POLLING_INTERVAL_MS = 1_000;

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

// Some RPCs can return a mined receipt whose blockHash is still the zero sentinel.
// We normalize that here, before writing the receipt into the transaction store,
// so downstream invalidation and lifecycle code can rely on a real block hash.
export async function resolveReceiptBlockHash(
  receipt: TransactionReceipt,
  publicClient: PublicClient,
  signal?: AbortSignal
) {
  if (!hasInvalidBlockHash(receipt.blockHash)) return receipt;
  if (receipt.blockNumber === null) return receipt;

  cofheLogger.warn('Mined receipt returned invalid zero blockHash; retrying until a real block hash is available', {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  });

  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw abortError();
    attempt += 1;

    try {
      const block = await publicClient.getBlock({
        blockNumber: receipt.blockNumber,
      });

      if (block.hash && !hasInvalidBlockHash(block.hash)) {
        cofheLogger.log('Resolved real blockHash for mined receipt after retry', {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          attempts: attempt,
          blockHash: block.hash,
        });

        return {
          ...receipt,
          blockHash: block.hash,
        };
      }

      cofheLogger.debug('Receipt blockHash still unavailable; retrying block lookup', {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        attempts: attempt,
        blockHash: block.hash,
      });
    } catch (error) {
      cofheLogger.warn('Failed to normalize mined receipt blockHash from blockNumber; retrying', {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        attempts: attempt,
        error,
      });
    }

    await sleep(RECEIPT_BLOCK_HASH_POLLING_INTERVAL_MS, signal);
  }
}
