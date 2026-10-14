import { parseAbi, type Address, type PublicClient } from 'viem';

import { COFHE_ADDRESS_BOOK_ADDRESS, TASK_MANAGER_ID } from './consts.js';
import { CofheError, CofheErrorCode } from './error.js';

const ADDRESS_BOOK_ABI = parseAbi([
  'function getTm(uint256 id) view returns (address)',
  'error TaskManagerNotSet(uint256 id)',
]);

const taskManagerAddressCache = new Map<number, Promise<Address>>();

/** Test hook: forget resolved addresses (e.g. between redeployments on one chainId). */
export const clearTaskManagerAddressCache = () => taskManagerAddressCache.clear();

/**
 * The chain's Task Manager, resolved through the CoFHEAddressBook
 * (`getTm(TASK_MANAGER_ID)`) - the same lookup FHE.sol performs on every call.
 *
 * Resolutions are cached per chainId. A failed resolution (network error, no
 * CoFHE deployment, id unset) is NOT cached, so a later call retries.
 */
export const getTaskManagerAddress = async (publicClient: PublicClient, chainId?: number): Promise<Address> => {
  const id = chainId ?? publicClient.chain?.id ?? (await publicClient.getChainId());

  const cached = taskManagerAddressCache.get(id);
  if (cached != null) return cached;

  const pending = publicClient
    .readContract({
      address: COFHE_ADDRESS_BOOK_ADDRESS,
      abi: ADDRESS_BOOK_ABI,
      functionName: 'getTm',
      args: [TASK_MANAGER_ID],
    })
    .catch((error: unknown) => {
      taskManagerAddressCache.delete(id);
      throw CofheError.fromError(error, {
        code: CofheErrorCode.TaskManagerUnresolved,
        message: `Failed to resolve the Task Manager from the CoFHEAddressBook on chain ${id}`,
        hint: 'Ensure CoFHE is deployed on this chain. On a local hardhat / anvil chain, deploy the CoFHE mocks first.',
        context: { chainId: id, addressBook: COFHE_ADDRESS_BOOK_ADDRESS, taskManagerId: TASK_MANAGER_ID },
      });
    });

  taskManagerAddressCache.set(id, pending);
  return pending;
};
