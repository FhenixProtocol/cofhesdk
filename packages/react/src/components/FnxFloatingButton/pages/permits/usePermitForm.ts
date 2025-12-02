import { useCallback, useState } from 'react';
import { useCofheClient } from '../../../../hooks/useCofheClient.js';

export interface UsePermitFormOptions {
  onSuccess?: () => void;
}

export interface UsePermitFormResult {
  permitName: string;
  receiver: string;
  isSelf: boolean;
  error: string | null; // global/submit error
  nameError: string | null; // field-specific error for name
  receiverError: string | null;
  isValid: boolean;
  isSubmitting: boolean;
  durationSeconds: number;
  handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleReceiverChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleIsSelf: (checked: boolean) => void;
  setDurationSeconds: (seconds: number) => void;
  handleSubmit: () => Promise<void>;
  reset: () => void;
}

export function usePermitForm(options: UsePermitFormOptions = {}): UsePermitFormResult {
  const { onSuccess } = options;
  const [permitName, setPermitName] = useState('');
  const [receiver, setReceiver] = useState('');
  const [isSelf, setIsSelf] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [receiverError, setReceiverError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(7 * 24 * 60 * 60);
  const cofheClient = useCofheClient();

  const isValid = !!permitName.trim() && (isSelf || isValidAddress(receiver));

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPermitName(e.target.value);
      if (nameError) setNameError(null);
    },
    [nameError]
  );

  const handleReceiverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setReceiver(e.target.value);
      if (receiverError) setReceiverError(null);
    },
    [receiverError]
  );

  const toggleIsSelf = useCallback((checked: boolean) => {
    setIsSelf(checked);
    // clear receiver-related errors when going back to self
    if (checked) setReceiverError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    const nameToUse = permitName.trim();
    if (!nameToUse) {
      setNameError('Permit name is required.');
      return;
    }
    if (!isSelf) {
      if (!isValidAddress(receiver)) {
        setReceiverError('Valid receiver address is required.');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const { account } = cofheClient.getSnapshot();
      if (!account) throw new Error('No connected account found');
      const expiration = Math.floor(Date.now() / 1000) + durationSeconds;
      if (isSelf) {
        await cofheClient.permits.createSelf({
          expiration,
          issuer: account,
          name: nameToUse,
        });
      } else {
        await cofheClient.permits.createSharing({
          expiration,
          issuer: account,
          recipient: receiver.trim() as `0x${string}`,
          name: nameToUse,
        });
      }
      setPermitName('');
      setReceiver('');
      setError(null);
      setNameError(null);
      setReceiverError(null);
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create permit');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, permitName, isSelf, receiver, durationSeconds, cofheClient, onSuccess]);

  const reset = useCallback(() => {
    setPermitName('');
    setReceiver('');
    setIsSelf(true);
    setError(null);
    setNameError(null);
    setReceiverError(null);
  }, []);

  return {
    permitName,
    receiver,
    isSelf,
    error,
    nameError,
    receiverError,
    isValid,
    isSubmitting,
    durationSeconds,
    handleNameChange,
    handleReceiverChange,
    toggleIsSelf,
    setDurationSeconds,
    handleSubmit,
    reset,
  };
}

function isValidAddress(address: string): boolean {
  const a = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}
