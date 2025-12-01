import { useCallback, useState } from 'react';
import { useCofheClient } from '../../../../hooks/useCofheClient.js';

export interface UsePermitFormResult {
  permitName: string;
  error: string | null;
  isValid: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: () => Promise<void>;
  reset: () => void;
}

export function usePermitForm(): UsePermitFormResult {
  const [permitName, setPermitName] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    const nameToUse = permitName.trim();
    if (!nameToUse) {
      setError('Permit name is required.');
      return;
    }
    const { account } = cofheClient.getSnapshot();
    if (!account) throw new Error('No connected account found');
    await cofheClient.permits.createSelf({
      expiration: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      issuer: account,
      name: nameToUse,
    });
  }, [permitName, cofheClient]);

  const reset = useCallback(() => {
    setPermitName('');
    setError(null);
  }, []);

  return { permitName, error, isValid, handleChange, handleSubmit, reset };
}
