import { useMutation } from '@tanstack/react-query';
import { useCofheClient } from '../useCofheClient.js';

export interface CreatePermitArgs {
  name: string;
  isSelf: boolean;
  receiver?: `0x${string}`;
  expirationSeconds: number; // unix timestamp (seconds)
}

export const useCofheCreatePermitMutation = () => {
  const cofheClient = useCofheClient();

  return useMutation<void, Error, CreatePermitArgs>({
    mutationFn: async ({ name, isSelf, receiver, expirationSeconds }) => {
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

      if (!receiver) throw new Error('Valid receiver address is required.');

      await cofheClient.permits.createSharing({
        expiration: expirationSeconds,
        issuer: account,
        recipient: receiver,
        name: name.trim(),
      });
    },
  });
};
