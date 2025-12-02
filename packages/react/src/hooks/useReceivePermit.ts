import { useState, useCallback } from 'react';
import { useCofheContext } from '../providers/CofheProvider.js';

export type UseReceivePermitReturn = {
  permitData: string;
  setPermitData: (v: string) => void;
  permitName: string;
  setPermitName: (v: string) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  submit: () => Promise<void>;
};

export function useReceivePermit(onSuccess?: () => void): UseReceivePermitReturn {
  const { client } = useCofheContext();

  const [permitData, setPermitData] = useState('');
  const [permitName, setPermitName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!permitData.trim()) {
      setErrorMsg('Please paste permit data.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await client.permits.importShared(permitData.trim());
      if (!result.success) throw result.error;

      setSuccessMsg('Permit received and set active.');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const message = err?.message ?? 'Failed to import permit';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [client, permitData, onSuccess]);

  return {
    permitData,
    setPermitData,
    permitName,
    setPermitName,
    isSubmitting,
    errorMsg,
    successMsg,
    submit,
  };
}
