import { TASK_MANAGER_ADDRESS } from '@cofhe/sdk';
import {
  useCofheReadContract,
  type UseCofheReadContractQueryOptions,
  type UseCofheReadContractResult,
} from './useCofheReadContract';

const TASK_MANAGER_IS_ENABLED_ABI = [
  {
    type: 'function',
    name: 'isEnabled',
    inputs: [],
    outputs: [
      {
        name: 'enabled',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
] as const;

export type UseCofheEnabledOptions = UseCofheReadContractQueryOptions<typeof TASK_MANAGER_IS_ENABLED_ABI, 'isEnabled'>;

export type UseCofheEnabledResult = UseCofheReadContractResult<typeof TASK_MANAGER_IS_ENABLED_ABI, 'isEnabled'>;

/**
 * Reads `TaskManager.isEnabled()` to determine whether Cofhe is enabled on the connected chain.
 */
export function useCofheEnabled(options?: UseCofheEnabledOptions): UseCofheEnabledResult {
  return useCofheReadContract(
    {
      address: TASK_MANAGER_ADDRESS,
      abi: TASK_MANAGER_IS_ENABLED_ABI,
      functionName: 'isEnabled',
      requiresPermit: false,
    },
    options
  );
}
