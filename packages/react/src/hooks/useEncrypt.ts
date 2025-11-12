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
  type UseMutateAsyncFunction,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useCofheConnection } from './useCofheConnection';
import { useCofheContext } from '../providers';
import { createEncryptableItem, type FheTypeValue } from '../utils';

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
  // eslint-disable-next-line no-unused-vars
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
  input: { value, type },
  onStep,
}: {
  client: CofhesdkClient | null;
  input: EncryptableInput;
  // eslint-disable-next-line no-unused-vars
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

type UseMutationResultEncryptAsync = UseMutationResult<EncryptedInput, Error, EncryptableInput, unknown>;

type UseMutationOptionsAsync = Omit<
  UseMutationOptions<EncryptedInput, Error, EncryptableInput, void>,
  'mutationFn' | 'mutationKey'
>;

type UseEncryptResult<TMutationResult, TMutationFn> = {
  stepsState: StepsState;
  _mutation: TMutationResult;
  api: TEncryptApi<TMutationFn>;
  isConnected: boolean;
};

// sometimes it's handy to inject args into mutation
export function useEncryptAsync(
  options: UseMutationOptionsAsync = {}
): UseEncryptResult<
  UseMutationResultEncryptAsync,
  UseMutateAsyncFunction<EncryptedInput, Error, EncryptableInput, void>
> {
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep, reset: resetSteps } = stepsState;

  const { onMutate, ...restOptions } = options;
  const mutationResult = useMutation({
    onMutate: (arg1, arg2) => {
      resetSteps();
      return onMutate?.(arg1, arg2);
    },
    mutationFn: (input: EncryptableInput) =>
      encryptValue({
        input,
        client,
        onStep,
      }),
    ...restOptions,
  });
  // const vars = mutationResult.variables;
  const api = {
    variables: mutationResult.variables,
    error: mutationResult.error,
    isEncrypting: mutationResult.isPending,
    data: mutationResult.data,
    encrypt: mutationResult.mutateAsync,
  };

  return {
    stepsState,
    _mutation: mutationResult,
    api,
    isConnected: useCofheConnection().connected,
  };
}

type EncryptableInput = { value: string; type: FheTypeValue };

type UseMutationResultEncryptSync = UseMutationResult<EncryptedInput, Error, void, unknown>;

type UseMutationOptionsEncryptSync = Omit<
  UseMutationOptions<EncryptedInput, Error, void, void>,
  'mutationFn' | 'mutationKey'
>;

type TEncryptApi<TMutateAsyncCallback> = {
  variables: EncryptableInput | undefined;
  error: Error | null;
  isEncrypting: boolean;
  data: EncryptedInput | undefined;
  encrypt: TMutateAsyncCallback;
};

// sometimes it's handy to inject args into the hook and then call mutation without args
export function useEncryptSync(
  input: EncryptableInput,
  options: UseMutationOptionsEncryptSync = {}
): UseEncryptResult<UseMutationResultEncryptSync, UseMutateAsyncFunction<EncryptedInput, Error, void, void>> {
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep, reset: resetSteps } = stepsState;
  const variables = useRef<EncryptableInput | undefined>(undefined);
  const { onMutate, ...restOptions } = options;
  const mutationResult = useMutation({
    onMutate: (arg1, arg2) => {
      variables.current = input;
      resetSteps();
      return onMutate?.(arg1, arg2);
    },
    mutationFn: () =>
      encryptValue({
        input,
        client,
        onStep,
      }),
    ...restOptions,
  });

  const api = {
    variables: variables.current,
    error: mutationResult.error,
    isEncrypting: mutationResult.isPending,
    data: mutationResult.data,
    encrypt: mutationResult.mutateAsync,
  };

  return {
    stepsState,
    _mutation: mutationResult,
    api,
    isConnected: useCofheConnection().connected,
  };
}
