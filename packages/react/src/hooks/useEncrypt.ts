import {
  type CofhesdkClient,
  type EncryptableItem,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedItemInputs,
  type EncryptedUint128Input,
  type EncryptedUint16Input,
  type EncryptedUint32Input,
  type EncryptedUint64Input,
  type EncryptedUint8Input,
  type EncryptStep,
  type EncryptStepCallbackContext,
} from '@cofhe/sdk';
import {
  useMutation,
  type UseMutateAsyncFunction,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useCofheConnection } from './useCofheConnection';
import { useCofheContext } from '../providers';
import { createEncryptableItemTyped, type FheTypeValue } from '../utils';

type EncryptedInput =
  | EncryptedBoolInput
  | EncryptedUint8Input
  | EncryptedUint16Input
  | EncryptedUint32Input
  | EncryptedUint64Input
  | EncryptedUint128Input
  | EncryptedAddressInput;

type TEncryptApi<T extends FheTypeValue> = {
  variables: MutationInput<T> | undefined;
  error: Error | null;
  isEncrypting: boolean;
  data: EncryptedInput | undefined;
  encrypt: UseMutateAsyncFunction<EncryptedInput, Error, MutationInput<T>, void>;
};

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

async function encryptValue<T extends EncryptableItem>({
  client,
  input,
  onStep,
}: {
  client: CofhesdkClient | null;
  input: T;
  // eslint-disable-next-line no-unused-vars
  onStep: (step: EncryptStep, context?: EncryptStepCallbackContext) => void;
}): Promise<EncryptedItemInputs<T>> {
  if (!client) throw new Error('CoFHE client not initialized');

  const encryptionBuilder = client.encryptInputs([input]).setStepCallback(onStep);
  const result = await encryptionBuilder.encrypt();

  if (!result.success) {
    throw result.error;
  }

  return result.data[0];
}

type UseMutationResultEncryptAsync<T extends FheTypeValue> = UseMutationResult<
  EncryptedInput,
  Error,
  MutationInput<T>,
  unknown
>;

type UseMutationOptionsAsync<T extends FheTypeValue> = Omit<
  UseMutationOptions<EncryptedInput, Error, MutationInput<T>, void>,
  'mutationFn'
>;

type UseEncryptResult<T extends FheTypeValue> = {
  stepsState: StepsState;
  _mutation: UseMutationResultEncryptAsync<T>;
  api: TEncryptApi<T>;
  isConnected: boolean;
};

type EncryptionOptions<T extends FheTypeValue> = {
  utype: T;
  account?: string;
  chainId?: number;
  securityZone?: number;
  onStepChange?: (step: EncryptStep, context?: EncryptStepCallbackContext) => void;
};

type MutationInputMap = {
  bool: boolean;
  address: string;
  uint8: bigint;
  uint16: bigint;
  uint32: bigint;
  uint64: bigint;
  uint128: bigint;
};

type MutationInput<T extends keyof MutationInputMap> = MutationInputMap[T];
// sometimes it's hadny to inject args into mutation
export function useEncryptAsync<T extends FheTypeValue>(
  encryptionOptions: EncryptionOptions<T>,
  mutationOptions: UseMutationOptionsAsync<T> = {}
): UseEncryptResult<T> {
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep: handleStepStateChange, reset: resetSteps } = stepsState;

  const { onMutate, mutationKey: mutationKeyPostfix, ...restOptions } = mutationOptions;

  const mutationResult = useMutation<EncryptedInput, Error, MutationInput<T>, void>({
    mutationKey: ['encryption', mutationKeyPostfix],
    onMutate: (arg1, arg2) => {
      resetSteps();
      return onMutate?.(arg1, arg2);
    },
    mutationFn: (mutationInput: MutationInput<T>) => {
      const { utype, onStepChange } = encryptionOptions;
      // Forward steps to both internal and external handlers
      const combinedOnStep = (step: EncryptStep, context?: EncryptStepCallbackContext) => {
        handleStepStateChange(step, context);
        onStepChange?.(step, context);
      };

      // Helper to correlate the generic S with the value type so narrowing works inside the switch
      /* eslint-disable no-redeclare, no-unused-vars */
      function buildInput(type: 'bool', value: MutationInput<'bool'>): EncryptableItem;
      function buildInput(type: 'address', value: MutationInput<'address'>): EncryptableItem;
      function buildInput(type: 'uint8', value: MutationInput<'uint8'>): EncryptableItem;
      function buildInput(type: 'uint16', value: MutationInput<'uint16'>): EncryptableItem;
      function buildInput(type: 'uint32', value: MutationInput<'uint32'>): EncryptableItem;
      function buildInput(type: 'uint64', value: MutationInput<'uint64'>): EncryptableItem;
      function buildInput(type: 'uint128', value: MutationInput<'uint128'>): EncryptableItem;
      function buildInput<S extends FheTypeValue>(type: S, value: MutationInput<S>): EncryptableItem;
      function buildInput(type: FheTypeValue, value: boolean | string | bigint): EncryptableItem {
        switch (type) {
          case 'bool':
            return createEncryptableItemTyped(value as MutationInput<'bool'>, 'bool');
          case 'address':
            return createEncryptableItemTyped(value as MutationInput<'address'>, 'address');
          case 'uint8':
            return createEncryptableItemTyped(value as MutationInput<'uint8'>, 'uint8');
          case 'uint16':
            return createEncryptableItemTyped(value as MutationInput<'uint16'>, 'uint16');
          case 'uint32':
            return createEncryptableItemTyped(value as MutationInput<'uint32'>, 'uint32');
          case 'uint64':
            return createEncryptableItemTyped(value as MutationInput<'uint64'>, 'uint64');
          case 'uint128':
            return createEncryptableItemTyped(value as MutationInput<'uint128'>, 'uint128');
          default: {
            const _exhaustive: never = type as never;
            throw new Error(`Unsupported FHE type: ${String(_exhaustive)}`);
          }
        }
      }
      /* eslint-enable no-redeclare, no-unused-vars */
      const input = buildInput(utype, mutationInput);

      return encryptValue({
        input,
        client,
        onStep: combinedOnStep,
      });
    },
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
