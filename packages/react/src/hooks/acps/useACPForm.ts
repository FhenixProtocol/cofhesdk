import { useCallback, useState } from 'react';
import { useCofheCreateACP, type CreateACPArgs } from './useCofheCreateACP';

export interface UseACPFormOptions {
  isDelegate?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface UseACPFormResult {
  acpName: string;
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

export function useACPForm(options: UseACPFormOptions = {}): UseACPFormResult {
  const { onSuccess, onError, isDelegate = false } = options;
  const [acpName, setACPName] = useState('');
  const [receiver, setReceiver] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [receiverError, setReceiverError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(7 * 24 * 60 * 60);
  const { mutateAsync: createACPMutateAsync, isPending: isACPCreationPending } = useCofheCreateACP({
    onSuccess,
    onError,
  });

  const recipientAddressValid = isDelegate ? isValidAddress(receiver) : true;
  const isValid = !!acpName.trim() && recipientAddressValid;

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setACPName(e.target.value);
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
    if (isACPCreationPending) return;
    const nameToUse = acpName.trim();
    if (!nameToUse) {
      setNameError('ACP name is required.');
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
      const args: CreateACPArgs = isDelegate
        ? { name: nameToUse, isSelf: false, receiver: receiver.trim() as `0x${string}`, expirationSeconds }
        : { name: nameToUse, isSelf: true, expirationSeconds };

      await createACPMutateAsync(args);
      setACPName('');
      setReceiver('');
      setError(null);
      setNameError(null);
      setReceiverError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create acp');
    }
  }, [isACPCreationPending, acpName, isDelegate, receiver, durationSeconds, createACPMutateAsync]);

  const reset = useCallback(() => {
    setACPName('');
    setReceiver('');
    setError(null);
    setNameError(null);
    setReceiverError(null);
  }, []);

  return {
    acpName,
    receiver,
    error,
    nameError,
    receiverError,
    isValid,
    isSubmitting: isACPCreationPending,
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
