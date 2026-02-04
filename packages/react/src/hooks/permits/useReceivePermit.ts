import { useState, useCallback } from 'react';
import { useCofheContext } from '../../providers/CofheProvider.js';
import { PermitUtils, type RecipientPermit } from '@cofhe/sdk/permits';

export type UseReceivePermitReturn = {
  importedPermit: RecipientPermit | null;
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

  const [importedPermit, setImportedPermit] = useState<RecipientPermit | null>(null);
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
      // If user provided a name, override the incoming permit's name
      let importArg: any | string = permitData.trim();
      if (permitName.trim()) {
        try {
          const parsed = JSON.parse(permitData.trim());
          importArg = { ...parsed, name: permitName.trim() };
        } catch (e) {
          setErrorMsg('Invalid permit data. Expected JSON.');
          setIsSubmitting(false);
          return;
        }
      }

      await client.permits.importShared(importArg);

      setSuccessMsg('Permit received and set active.');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const message = err?.message ?? 'Failed to import permit';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [client, permitData, permitName, onSuccess]);

  const handleSetPermitData = useCallback((v: string) => {
    setPermitData(v);
    try {
      const permit = PermitUtils.importShared(v);
      setImportedPermit(permit);
      setErrorMsg(null);
    } catch (e) {
      console.error('Error parsing pasted permit data', e);
      setImportedPermit(null);
      // TODO: Improve error message, we have the error message in the caught error but its a zod error so its messy
      setErrorMsg(`Invalid permit data. Expected JSON.`);
    }
  }, []);

  return {
    importedPermit,
    permitData,
    setPermitData: handleSetPermitData,
    permitName,
    setPermitName,
    isSubmitting,
    errorMsg,
    successMsg,
    submit,
  };
}

const importPermitData ={
  "name": "Delegate to self",
  "type": "sharing",
  "issuer": "0x2e988A386a799F506693793c6A5AF6B54dfAaBfB",
  "expiration": 1770802443,
  "recipient": "0x170A592d0edf5c00036e09Ec22b710c47D1880d7",
  "issuerSignature": "0xHello",
}

// Checks that permit is formed correctly and will give access to data
// Usage `checkPermitValidity`:
//  - before decryption? (decryption will already let you know if the permit is invalid - it will fail. Would be redundant check)
//  - on permit selection
//  - on permit creation
const checkPermitValidity = () => true;

// Only checks data from issuer before sending to recipient
const checkImportPermitDataValidity = () => true;

