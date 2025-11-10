import { createEncryptableItem, useCofheContext, type FheTypeValue } from '@cofhe/react';
import type {
  CofhesdkClient,
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
import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

type StepsState = {
  onStep: (step: EncryptStep, context?: EncryptStepCallbackContext) => void;
  reset: () => void;
  compactSteps: CompactSteps;
  lastStep: EncryptionStep | null;
};
type UseEncryptResult = {
  queryResult: UseEncryptQueryResult;
  stepsState: StepsState;
};

function useStepsState(): StepsState {
  const [steps, setSteps] = useState<EncryptionStep[]>([]);
  const onStep = useCallback((step: EncryptStep, context?: EncryptStepCallbackContext) => {
    if (step === 'initTfhe' && context?.isStart) {
      // init with a single-element array
      setSteps([{ step, context }]);
    } else {
      setSteps((prev) => [...prev, { step, context }]);
    }
  }, []);

  const compactSteps = useMemo(() => validateAndCompactizeSteps(steps), [steps]);
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;

  const reset = useCallback(() => setSteps([]), []);
  return {
    onStep,
    reset,
    compactSteps,
    lastStep,
  };
}

export function useEncryptFromArgs(value: string, type: FheTypeValue, options: Options = {}): UseEncryptResult {
  const client = useCofheContext().client;

  const stepsState = useStepsState();
  const { onStep, reset: resetSteps } = stepsState;

  useEffect(() => {
    resetSteps();
  }, [value, type]);

  // probably it should rather be a mutation?
  const queryResult = useQuery({
    queryKey: ['encrypt', value, type],
    queryFn: async () => {
      return encryptValue({
        client,
        value,
        type,
        onStep,
      });
    },
    retry: false, // prevent default 3 exponentialy timed retries
    ...options,
  });

  return {
    queryResult,
    stepsState,
  };
}

async function encryptValue({
  client,
  value,
  type,
  onStep,
}: {
  client: CofhesdkClient | null;
  value: string;
  type: FheTypeValue;
  onStep: (step: EncryptStep, context?: EncryptStepCallbackContext) => void;
}): Promise<EncryptedInput> {
  if (!client) throw new Error('CoFHE client not initialized');

  const encryptableItem = createEncryptableItem(value, type);
  const encryptionBuilder = client.encryptInputs([encryptableItem]).setStepCallback(onStep);
  const result = await encryptionBuilder.encrypt();

  if (!result.success) {
    throw result.error;
  }

  return result.data[0];
}

type FheMutationResult = UseMutationResult<
  EncryptedInput,
  Error,
  {
    value: string;
    type: FheTypeValue;
  },
  unknown
>;

export function useEncryptValueViaCallback(): {
  stepsState: StepsState;
  mutation: FheMutationResult;
} {
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep } = stepsState;
  const mutationResult: FheMutationResult = useMutation({
    mutationFn: ({ value, type }: { value: string; type: FheTypeValue }) =>
      encryptValue({
        value,
        type,
        client,
        onStep,
      }),
  });

  return {
    stepsState,
    mutation: mutationResult,
  };
}
