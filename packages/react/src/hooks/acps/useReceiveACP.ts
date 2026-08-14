import { useState, useCallback } from 'react';
import { useCofheContext } from '../../providers/CofheProvider.js';
import { ACPUtils, type RecipientACP } from '@cofhe/sdk/acps';
import { cofheLogger } from '@/utils/debug.js';

export type UseReceiveACPReturn = {
  importedACP: RecipientACP | null;
  acpData: string;
  setACPData: (v: string) => void;
  acpName: string;
  setACPName: (v: string) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  submit: () => Promise<void>;
};

type Input = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export function useReceiveACP({ onSuccess, onError }: Input = {}): UseReceiveACPReturn {
  const { client } = useCofheContext();

  const [importedACP, setImportedACP] = useState<RecipientACP | null>(null);
  const [acpData, setACPData] = useState('');
  const [acpName, setACPName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!acpData.trim()) {
      setErrorMsg('Please paste acp data.');
      return;
    }

    try {
      setIsSubmitting(true);
      // If user provided a name, override the incoming acp's name
      let importArg: any | string = acpData.trim();
      if (acpName.trim()) {
        try {
          const parsed = JSON.parse(acpData.trim());
          importArg = { ...parsed, name: acpName.trim() };
        } catch (e) {
          setErrorMsg('Invalid acp data. Expected JSON.');
          setIsSubmitting(false);
          return;
        }
      }

      await client.acp.importShared(importArg);

      setSuccessMsg('ACP received and set active.');
      onSuccess?.();
    } catch (err: any) {
      const message = err?.message ?? 'Failed to import acp';
      setErrorMsg(message);
      onError?.(new Error(message));
    } finally {
      setIsSubmitting(false);
    }
  }, [client, acpData, acpName, onSuccess, onError]);

  const handleSetACPData = useCallback((v: string) => {
    setACPData(v);
    try {
      const acp = ACPUtils.importShared(v);
      setImportedACP(acp);
      setErrorMsg(null);
    } catch (e) {
      cofheLogger.error('Error parsing pasted acp data', e);
      setImportedACP(null);
      // TODO: Improve error message, we have the error message in the caught error but its a zod error so its messy
      setErrorMsg(`Invalid acp data. Expected JSON.`);
    }
  }, []);

  return {
    importedACP,
    acpData,
    setACPData: handleSetACPData,
    acpName,
    setACPName,
    isSubmitting,
    errorMsg,
    successMsg,
    submit,
  };
}
