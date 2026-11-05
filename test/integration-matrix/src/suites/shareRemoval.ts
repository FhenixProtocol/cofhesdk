import { BaseError, ContractFunctionRevertedError, type Hex } from 'viem';

const UNKNOWN_SHARE = '0x3d03aecf';

/**
 * Only for a share this test has already posted and discovered. A load-balanced
 * RPC can estimate the removal on a node that has not seen the share yet.
 * Retry that pre-submission revert; receipt waiting belongs outside this helper
 * so an accepted transaction is never submitted again here.
 */
export async function removeConfirmedShare(
  remove: () => Promise<Hex>,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
): Promise<Hex> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await remove();
    } catch (error) {
      const revert =
        error instanceof BaseError ? error.walk((cause) => cause instanceof ContractFunctionRevertedError) : undefined;
      const unknownShare =
        revert instanceof ContractFunctionRevertedError &&
        (revert.signature === UNKNOWN_SHARE || revert.data?.errorName === 'UnknownShare');
      if (!unknownShare || attempt >= 6) throw error;
      await wait(5_000);
    }
  }
}
