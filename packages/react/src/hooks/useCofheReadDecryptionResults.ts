// function getDecryptResult(uint256 ctHash) external view returns (uint256) {
//         (uint256 result, bool hadResult) = plaintextsStorage.getResult(ctHash);
//         if (!hadResult) {
//             revert DecryptionResultNotReady(ctHash);
//         }
//         return result;
//     }

import { useMemo } from 'react';
import { useCofheReadContractMany } from './useCofheReadContractMany';

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
export function useCofheReadDecryptionResults(ciphertexts: string[]) {
  const { results } = useCofheReadContractMany(
    {
      address: TASK_MANAGER_ADDRESS,
      abi: TASK_MANAGER_ABI,
      functionName: 'getDecryptResultSafe',
      argsList: ciphertexts.map((ct): [bigint] => [BigInt(ct)]),
    },
    {
      // poll if data not available (means wasn't decrypted yet)
      // TODO: check if it truly sends just one request
      refetchInterval: (query) => (query.state.data === undefined ? DECRYPTION_RESULT_POLLING_INTERVAL_MS : false),
    }
  );

  const isDecryptedByCt = useMemo(() => {
    return results.reduce<Record<string, any>>((record, res, index) => {
      const ct = ciphertexts[index];

      record[ct] = res.data && res.data;

      return record;
    }, {});
  }, [ciphertexts, results]);

  console.log('useCofheReadDecryptionResults', { ciphertexts, results, isDecryptedByCt });
  return isDecryptedByCt;
}
