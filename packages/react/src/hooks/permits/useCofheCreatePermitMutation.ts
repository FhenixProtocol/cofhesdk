import { usePortalPersisted } from '@/stores/portalPersisted.js';
import { useInternalMutation } from '../../providers/index.js';
import { useCofheClient } from '../useCofheClient.js';

export type CreatePermitArgs =
  | {
      name: string;
      isSelf: true;
      expirationSeconds: number; // unix timestamp (seconds)
    }
  | {
      name: string;
      isSelf: false;
      receiver: `0x${string}`;
      expirationSeconds: number; // unix timestamp (seconds)
    };

export const useCofheCreatePermitMutation = () => {
  const cofheClient = useCofheClient();
  const { setHasCreatedFirstPermit } = usePortalPersisted();

  return useInternalMutation<void, Error, CreatePermitArgs>({
    onSettled: () => {
      // Mark that the user has created at least one permit - from now on, we know the user is aware of permits and will show him warnnings and notifications accordingly
      setHasCreatedFirstPermit(true);
    },
    mutationFn: async (args) => {
      const { name, isSelf, expirationSeconds } = args;
      const { account } = cofheClient.getSnapshot();
      if (!account) throw new Error('No connected account found');

      if (isSelf) {
        await cofheClient.permits.createSelf({
          expiration: expirationSeconds,
          issuer: account,
          name: name.trim(),
        });
        return;
      }

      await cofheClient.permits.createSharing({
        expiration: expirationSeconds,
        issuer: account,
        recipient: args.receiver,
        name: name.trim(),
      });
    },
  });
};
