import { useCallback, useState } from 'react';
import { useCofheCreatePermitMutation, type CreatePermitArgs } from './useCofheCreatePermitMutation';

export interface UsePermitFormOptions {
  isDelegate?: boolean;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export interface UsePermitFormResult {
  permitName: string;
  receiver: string;
  error: string | null; // global/submit error
  nameError: string | null; // field-specific error for name
  receiverError: string | null;
  isValid: boolean;
  isSubmitting: boolean;
  durationSeconds: number;
  handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleReceiverChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setDurationSeconds: (seconds: number) => void;
  handleSubmit: () => Promise<void>;
  reset: () => void;
}

export function usePermitForm(options: UsePermitFormOptions = {}): UsePermitFormResult {
  const { onSuccess, onError, isDelegate = false } = options;
  const [permitName, setPermitName] = useState('');
  const [receiver, setReceiver] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [receiverError, setReceiverError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(7 * 24 * 60 * 60);
  const { mutateAsync: createPermitMutateAsync, isPending: isPermitCreationPending } = useCofheCreatePermitMutation();

  const recipientAddressValid = isDelegate ? isValidAddress(receiver) : true;
  const isValid = !!permitName.trim() && recipientAddressValid;

  console.log({
    isValid,
    recipientAddressValid,
    isDelegate,
    receiverIsValid: isValidAddress(receiver),
    permitName,
    trimmedPermitName: permitName.trim(),
  });

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

  const handleSubmit = useCallback(async () => {
    if (isPermitCreationPending) return;
    const nameToUse = permitName.trim();
    if (!nameToUse) {
      setNameError('Permit name is required.');
      return;
    }
    if (isDelegate) {
      if (!isValidAddress(receiver)) {
        setReceiverError('Valid receiver address is required.');
        return;
      }
    }
    try {
      const expirationSeconds = Math.floor(Date.now() / 1000) + durationSeconds;
      const args: CreatePermitArgs = isDelegate
        ? { name: nameToUse, isSelf: false, receiver: receiver.trim() as `0x${string}`, expirationSeconds }
        : { name: nameToUse, isSelf: true, expirationSeconds };

      await createPermitMutateAsync(args);
      setPermitName('');
      setReceiver('');
      setError(null);
      setNameError(null);
      setReceiverError(null);
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create permit');
      onError?.(e?.message ?? 'Failed to create permit');
    }
  }, [
    isPermitCreationPending,
    permitName,
    isDelegate,
    receiver,
    durationSeconds,
    createPermitMutateAsync,
    onSuccess,
    onError,
  ]);

  const reset = useCallback(() => {
    setPermitName('');
    setReceiver('');
    setError(null);
    setNameError(null);
    setReceiverError(null);
  }, []);

  return {
    permitName,
    receiver,
    error,
    nameError,
    receiverError,
    isValid,
    isSubmitting: isPermitCreationPending,
    durationSeconds,
    handleNameChange,
    handleReceiverChange,
    setDurationSeconds,
    handleSubmit,
    reset,
  };
}

function isValidAddress(address: string): boolean {
  const a = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}
