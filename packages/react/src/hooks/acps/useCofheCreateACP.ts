import { usePortalPersisted } from '@/stores/portalPersisted.js';
import { useInternalMutation } from '../../providers/index.js';
import { useCofheClient } from '../useCofheClient.js';

/**
 * When the ACP expires: at `expirationSeconds` (unix timestamp, seconds), or `durationSeconds` from
 * now. The ACL checks expiry against the block timestamp, so "now" is the later of the latest
 * block's timestamp and the local clock: a chain moved ahead (`time.increase`) does not get an ACP
 * that is already expired, and an idle node whose latest block is old does not get a shorter one.
 *
 * `expirationSeconds` is used as given. If you build it from `Date.now()`, it can already be in the
 * past on a chain whose clock is ahead of the machine's; pass `durationSeconds` instead.
 */
type CreateACPExpiration =
  | {
      expirationSeconds: number; // unix timestamp (seconds)
      durationSeconds?: undefined;
    }
  | {
      durationSeconds: number; // seconds from now (the later of the latest block and the local clock)
      expirationSeconds?: undefined;
    };

export type CreateACPArgs = (
  | {
      name: string;
      isSelf: true;
    }
  | {
      name: string;
      isSelf: false;
      receiver: `0x${string}`;
    }
) &
  CreateACPExpiration;

type Input = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useCofheCreateACP = ({ onSuccess, onError }: Input = {}) => {
  const cofheClient = useCofheClient();
  const { setHasCreatedFirstACP } = usePortalPersisted();

  return useInternalMutation<void, Error, CreateACPArgs>({
    onSuccess,
    onError,
    onSettled: () => {
      // Mark that the user has created at least one acp
      // After this, we will show him warnings and notifications accordingly
      setHasCreatedFirstACP(true);
    },
    mutationFn: async (args) => {
      const { name, isSelf } = args;
      const { account, publicClient } = cofheClient.getSnapshot();
      if (!account) throw new Error('No connected account found');

      let expiration = args.expirationSeconds;
      if (args.durationSeconds != null) {
        if (!publicClient) throw new Error('No connected public client found');
        const latestBlock = await publicClient.getBlock();
        const nowSec = Math.max(Number(latestBlock.timestamp), Math.floor(Date.now() / 1000));
        expiration = nowSec + args.durationSeconds;
      }

      if (isSelf) {
        await cofheClient.acp.createSelf({
          expiration,
          issuer: account,
          name: name.trim(),
        });
        return;
      }

      await cofheClient.acp.createSharing({
        expiration,
        issuer: account,
        recipient: args.receiver,
        name: name.trim(),
      });
    },
  });
};
