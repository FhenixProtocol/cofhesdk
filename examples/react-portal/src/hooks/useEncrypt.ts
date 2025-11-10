import { createEncryptableItem, useCofheContext, type FheTypeValue } from '@cofhe/react';
import type {
  EncryptedAddressInput,
  EncryptedBoolInput,
  EncryptedUint128Input,
  EncryptedUint16Input,
  EncryptedUint32Input,
  EncryptedUint64Input,
  EncryptedUint8Input,
  EncryptStep,
  EncryptStepCallbackContext,
} from '@cofhe/sdk';
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

type Options = Omit<UseQueryOptions<EncryptedInput, Error>, 'queryKey' | 'queryFn'>;

type EncryptedInput =
  | EncryptedBoolInput
  | EncryptedUint8Input
  | EncryptedUint16Input
  | EncryptedUint32Input
  | EncryptedUint64Input
  | EncryptedUint128Input
  | EncryptedAddressInput;

type UseEncryptQueryResult = UseQueryResult<EncryptedInput, Error>;

type EncryptionStep = { step: EncryptStep; context?: EncryptStepCallbackContext };
type StepWithOrder = `${number}_${EncryptStep}_${'start' | 'stop'}`;
type CompactSteps = Partial<Record<StepWithOrder, number | undefined>>;

function validateAndCompactizeSteps(encSteps: EncryptionStep[]): CompactSteps {
  const result: CompactSteps = {};
  encSteps.forEach((encStep, index) => {
    const postfix = encStep.context?.isStart ? 'start' : encStep.context?.isEnd ? 'stop' : null;
    if (!postfix) throw new Error('Invalid step context: must be start or end');

    const idx: StepWithOrder = `${index}_${encStep.step}_${postfix}`;

    result[idx] = encStep.context?.duration;
  });

  return result;
}

type UseEncryptResult = {
  queryResult: UseEncryptQueryResult;
  rawStreps: EncryptionStep[];
  lastStep: EncryptionStep | null;
  compactSteps: CompactSteps;
};

export function useEncrypt(value: string, type: FheTypeValue, options: Options = {}): UseEncryptResult {
  const client = useCofheContext().client;

  const [steps, setSteps] = useState<EncryptionStep[]>([]);

  useEffect(() => {
    setSteps([]);
  }, [value, type]);

  // probably it should rather be a mutation?
  const queryResult = useQuery({
    queryKey: ['encrypt', value, type],
    queryFn: async () => {
      setSteps([]);
      if (!client) throw new Error('CoFHE client not initialized');

      const encryptableItem = createEncryptableItem(value, type);
      const encryptionBuilder = client.encryptInputs([encryptableItem]).setStepCallback((step, context) => {
        setSteps((prevSteps) => [...prevSteps, { step, context }]);
      });
      const result = await encryptionBuilder.encrypt();

      if (!result.success) {
        throw result.error;
      }

      return result.data[0];
    },
    retry: false, // prevent default 3 exponentialy timed retries
    ...options,
  });

  const compactSteps = useMemo(() => validateAndCompactizeSteps(steps), [steps]);
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;

  return {
    queryResult,
    rawStreps: steps,
    lastStep,
    compactSteps: compactSteps,
  };
}
