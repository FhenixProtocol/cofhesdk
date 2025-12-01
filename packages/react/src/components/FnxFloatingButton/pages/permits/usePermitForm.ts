import { useCallback, useState } from 'react';
import { useCofheClient } from '../../../../hooks/useCofheClient.js';

export interface UsePermitFormOptions {
  onSuccess?: () => void;
}

export interface UsePermitFormResult {
  permitName: string;
  error: string | null;
  isValid: boolean;
  isSubmitting: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: () => Promise<void>;
  reset: () => void;
}

export function usePermitForm(options: UsePermitFormOptions = {}): UsePermitFormResult {
  const { onSuccess } = options;
  const [permitName, setPermitName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cofheClient = useCofheClient();

  const isValid = !!permitName.trim();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPermitName(e.target.value);
      if (error) setError(null);
    },
    [error]
  );

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    const nameToUse = permitName.trim();
    if (!nameToUse) {
      setError('Permit name is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { account } = cofheClient.getSnapshot();
      if (!account) throw new Error('No connected account found');
      await cofheClient.permits.createSelf({
        expiration: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        issuer: account,
        name: nameToUse,
      });
      setPermitName('');
      setError(null);
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create permit');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, permitName, cofheClient, onSuccess]);

  const reset = useCallback(() => {
    setPermitName('');
    setError(null);
  }, []);

  return { permitName, error, isValid, isSubmitting, handleChange, handleSubmit, reset };
}
