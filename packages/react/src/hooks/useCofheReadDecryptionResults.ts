import { useMemo } from 'react';
import { useInternalQueries } from '@/providers';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';

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

// TODO: find proper place to put this constant, it's also duped now (exists in hardhat package)
export const TASK_MANAGER_ADDRESS = '0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9';

// function getDecryptResultSafe(uint256 ctHash) external view returns (uint256, bool)
const TASK_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getDecryptResultSafe',
    inputs: [
      {
        name: 'ctHash',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'decrypted',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
] as const;

const DECRYPTION_RESULT_POLLING_INTERVAL_MS = 5_000;
export type DecryptionResultWithObservedBlock = {
  result: bigint;
  decrypted: true;
  observedAt: {
    blockNumber: bigint;
    blockHash: `0x${string}`;
  };
};
export function useCofheReadDecryptionResults(ciphertexts: Set<string>) {
  const publicClient = useCofhePublicClient();
  const chainId = useCofheChainId();

  const queries = useMemo(() => {
    return Array.from(ciphertexts).map((ct) => {
      return {
        queryKey: ['decryptionResult', chainId, ct] as const,
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          if (!publicClient) throw new Error('PublicClient is required');

          // Keep the query in-flight until the decryption result is available.
          // This way `isFetching` reflects the real "waiting for decryption" period.
          while (!signal.aborted) {
            // Try to fetch (1) decryption result and (2) latest block header together.
            // If the transport batches, these should go in one JSON-RPC batch.
            const [res, block] = await Promise.allSettled([
              publicClient.readContract({
                address: TASK_MANAGER_ADDRESS,
                abi: TASK_MANAGER_ABI,
                functionName: 'getDecryptResultSafe',
                args: [BigInt(ct)],
              }),
              publicClient.getBlock(),
            ]);

            if (
              res.status === 'fulfilled' &&
              block.status === 'fulfilled' &&
              block.value?.hash &&
              block.value?.number
            ) {
              const decoded = res.value;
              const result = decoded[0];
              const decrypted = decoded[1];

              if (decrypted) {
                const data: DecryptionResultWithObservedBlock = {
                  result,
                  decrypted: true,
                  observedAt: {
                    blockNumber: block.value.number,
                    blockHash: block.value.hash,
                  },
                };

                return data;
              }
            }

            await sleep(DECRYPTION_RESULT_POLLING_INTERVAL_MS, signal);
          }

          throw abortError();
        },
        enabled: !!publicClient && !!chainId && ct !== undefined,
      };
    });
  }, [chainId, ciphertexts, publicClient]);

  const results = useInternalQueries({ queries });

  const isDecryptedByCt = useMemo(() => {
    return results.reduce<Record<string, DecryptionResultWithObservedBlock | undefined>>((record, res, index) => {
      const ct = Array.from(ciphertexts)[index];

      record[ct] = res.data;

      return record;
    }, {});
  }, [ciphertexts, results]);

  return isDecryptedByCt;
}
