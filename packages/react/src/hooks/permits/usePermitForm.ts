import { useCallback, useState } from 'react';
import { useCofheCreatePermitMutation, type CreatePermitArgs } from './useCofheCreatePermitMutation';

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

export interface UsePermitFormOptions {
  onSuccess?: () => void;
}

export function usePermitForm({ onSuccess }: UsePermitFormOptions = {}): UsePermitFormResult {
  const [permitName, setPermitName] = useState('');
  const [receiver, setReceiver] = useState('');
  const [isSelf, setIsSelf] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [receiverError, setReceiverError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(7 * 24 * 60 * 60);
  const { mutateAsync: createPermitMutateAsync, isPending: isPermitCreationPending } = useCofheCreatePermitMutation({
    onSuccess,
  });

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
    if (isPermitCreationPending) return;
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
    try {
      const expirationSeconds = Math.floor(Date.now() / 1000) + durationSeconds;
      const args: CreatePermitArgs = isSelf
        ? { name: nameToUse, isSelf: true, expirationSeconds }
        : { name: nameToUse, isSelf: false, receiver: receiver.trim() as `0x${string}`, expirationSeconds };
      await createPermitMutateAsync(args);
      setPermitName('');
      setReceiver('');
      setError(null);
      setNameError(null);
      setReceiverError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create permit');
    }
  }, [isPermitCreationPending, permitName, isSelf, receiver, durationSeconds, createPermitMutateAsync]);

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
    isSubmitting: isPermitCreationPending,
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
