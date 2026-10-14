import { useCofheTaskManagerAddress } from './useCofheTaskManagerAddress';
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
 * The Task Manager is resolved through the CoFHEAddressBook first; the read stays disabled until it is.
 */
export function useCofheEnabled(options?: UseCofheEnabledOptions): UseCofheEnabledResult {
  const { data: taskManagerAddress } = useCofheTaskManagerAddress();

  return useCofheReadContract(
    {
      address: taskManagerAddress,
      abi: TASK_MANAGER_IS_ENABLED_ABI,
      functionName: 'isEnabled',
      requiresACP: false,
    },
    options
  );
}
