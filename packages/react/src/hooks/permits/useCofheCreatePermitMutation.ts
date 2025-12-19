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

  return useInternalMutation<void, Error, CreatePermitArgs>({
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
