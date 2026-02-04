import { usePortalPersisted } from '@/stores/portalPersisted.js';
import { useInternalMutation } from '../../providers/index.js';
import { useCofheClient } from '../useCofheClient.js';
import { usePortalToasts } from '@/stores/portalToasts.js';

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

type Input = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};
export const useCofheCreatePermitMutation = ({ onSuccess, onError }: Input = {}) => {
  const cofheClient = useCofheClient();
  const { setHasCreatedFirstPermit } = usePortalPersisted();
  const { addToast } = usePortalToasts();

  return useInternalMutation<void, Error, CreatePermitArgs>({
    onSuccess: () => {
      addToast({
        variant: 'success',
        title: 'Permit Created',
        description: 'The permit has been created successfully.',
      });

      onSuccess?.();
    },
    onError: (error) => {
      onError?.(error);
    },
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
