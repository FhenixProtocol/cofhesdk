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
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

type EncryptedInput =
  | EncryptedBoolInput
  | EncryptedUint8Input
  | EncryptedUint16Input
  | EncryptedUint32Input
  | EncryptedUint64Input
  | EncryptedUint128Input
  | EncryptedAddressInput;

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

type UseMutationResultEncryptFromCallbackArgs = UseMutationResult<
  EncryptedInput,
  Error,
  {
    value: string;
    type: FheTypeValue;
  },
  unknown
>;

// sometimes it's hadny to inject args into mutation
export function useEncryptFromCallbackArgs(): {
  stepsState: StepsState;
  mutation: UseMutationResultEncryptFromCallbackArgs;
} {
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep, reset } = stepsState;
  const mutationResult = useMutation({
    onMutate: reset,
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

type UseMutationResultEncryptFromHookArgs = UseMutationResult<EncryptedInput, Error, void, unknown>;

// sometimes it's hadny to inject args into the hook and then call mutation without args
export function useEncryptFromHookArgs(
  value: string,
  type: FheTypeValue
): {
  stepsState: StepsState;
  mutation: UseMutationResultEncryptFromHookArgs;
} {
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep, reset } = stepsState;
  const mutationResult = useMutation({
    onMutate: reset,
    mutationFn: () =>
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
