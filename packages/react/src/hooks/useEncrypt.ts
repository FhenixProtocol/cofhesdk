import {
  Encryptable,
  type CofhesdkClient,
  type EncryptableAddress,
  type EncryptableBool,
  type EncryptableUint128,
  type EncryptableUint16,
  type EncryptableUint32,
  type EncryptableUint64,
  type EncryptableUint8,
  type EncryptedItemInputs,
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
import { type FheTypeValue } from '../utils';
import { assert } from 'ts-essentials';

type EncryptedInput<T extends FheTypeValue> = EncryptResultByFheTypeValue<T>;

type TEncryptApi<T extends FheTypeValue> = {
  variables: MutationInput<T> | undefined;
  error: Error | null;
  isEncrypting: boolean;
  data: EncryptedInput<T> | undefined;
  encrypt: UseMutateAsyncFunction<EncryptedInput<T>, Error, MutationInput<T>, void>;
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

type EncryptableItemMap = {
  bool: EncryptableBool;
  address: EncryptableAddress;
  uint8: EncryptableUint8;
  uint16: EncryptableUint16;
  uint32: EncryptableUint32;
  uint64: EncryptableUint64;
  uint128: EncryptableUint128;
};

type EncryptableItemByFheTypeValue<T extends FheTypeValue> = EncryptableItemMap[T];

type EncryptResultByFheTypeValue<T extends FheTypeValue> = EncryptedItemInputs<EncryptableItemByFheTypeValue<T>>;

async function encryptValue<T extends FheTypeValue>({
  client,
  input,
  onStep,
}: {
  client: CofhesdkClient | null;
  input: EncryptableItemByFheTypeValue<T>;
  // eslint-disable-next-line no-unused-vars
  onStep: (step: EncryptStep, context?: EncryptStepCallbackContext) => void;
}): Promise<EncryptResultByFheTypeValue<T>> {
  if (!client) throw new Error('CoFHE client not initialized');

  const encryptionBuilder = client.encryptInputs([input]).setStepCallback(onStep);
  const result = await encryptionBuilder.encrypt();

  if (!result.success) {
    throw result.error;
  }

  return result.data[0];
}

type UseMutationResultEncryptAsync<T extends FheTypeValue> = UseMutationResult<
  EncryptedInput<T>,
  Error,
  MutationInput<T>,
  unknown
>;

type UseMutationOptionsAsync<T extends FheTypeValue> = Omit<
  UseMutationOptions<EncryptedInput<T>, Error, MutationInput<T>, void>,
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
  // eslint-disable-next-line no-unused-vars
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
const encryptableFactory: {
  // eslint-disable-next-line no-unused-vars
  [K in FheTypeValue]: (value: MutationInputMap[K]) => EncryptableItemMap[K];
} = {
  bool: (value) => {
    assert(typeof value === 'boolean', 'Expected boolean value for type bool');
    return Encryptable.bool(value);
  },
  address: (value) => {
    assert(typeof value === 'string', 'Expected string value for type address');
    return Encryptable.address(value);
  },
  uint8: (value) => {
    assert(typeof value === 'bigint' || typeof value === 'string', 'Expected bigint or string value for type uint8');
    return Encryptable.uint8(value);
  },
  uint16: (value) => {
    assert(typeof value === 'bigint' || typeof value === 'string', 'Expected bigint or string value for type uint16');
    return Encryptable.uint16(value);
  },
  uint32: (value) => {
    assert(typeof value === 'bigint' || typeof value === 'string', 'Expected bigint or string value for type uint32');
    return Encryptable.uint32(value);
  },
  uint64: (value) => {
    assert(typeof value === 'bigint' || typeof value === 'string', 'Expected bigint or string value for type uint64');
    return Encryptable.uint64(value);
  },
  uint128: (value) => {
    assert(typeof value === 'bigint' || typeof value === 'string', 'Expected bigint or string value for type uint128');
    return Encryptable.uint128(value);
  },
};

function prepareEncryptable<U extends FheTypeValue>(utype: U, value: MutationInputMap[U]): EncryptableItemMap[U] {
  return encryptableFactory[utype](value);
}
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

  const mutationResult = useMutation<EncryptedInput<T>, Error, MutationInput<T>, void>({
    mutationKey: ['encryption', mutationKeyPostfix],
    onMutate: (arg1, arg2) => {
      resetSteps();
      return onMutate?.(arg1, arg2);
    },
    mutationFn: async (mutationInput) => {
      const { utype, onStepChange } = encryptionOptions;
      // Forward steps to both internal and external handlers
      const combinedOnStep = (step: EncryptStep, context?: EncryptStepCallbackContext) => {
        handleStepStateChange(step, context);
        onStepChange?.(step, context);
      };

      const input = prepareEncryptable(utype, mutationInput);

      const encrypted = await encryptValue({
        input,
        client,
        onStep: combinedOnStep,
      });
      return encrypted;
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
