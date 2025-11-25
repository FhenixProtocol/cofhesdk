/* eslint-disable no-unused-vars */
import {
  Encryptable,
  EncryptStep,
  FheTypes,
  type CofhesdkClient,
  type EncryptableBool,
  type EncryptableItem,
  type EncryptableUint128,
  type EncryptableUint8,
  type EncryptedItemInputs,
  type EncryptStepCallbackContext,
} from '@cofhe/sdk';
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useCofheConnection } from './useCofheConnection';
import { useCofheContext } from '../providers';

type EncryptableArray = readonly EncryptableItem[];
type EncryptedInputs<T extends EncryptableItem | EncryptableArray> = T extends EncryptableArray
  ? EncryptedItemInputs<[...T]>
  : EncryptedItemInputs<T>;
type ArrayifyEncryptableInputs<T extends EncryptableItem | EncryptableArray> = T extends EncryptableArray
  ? [...T]
  : [T];

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

// Key is identifier for each encryption mutation call
type StepsState = {
  onStep: (key: string, step: EncryptStep, context?: EncryptStepCallbackContext) => void;
  onSetKey: (key: string | null) => void;
  compactSteps: CompactSteps;
  lastStep: EncryptionStep | null;
};

function useStepsState(): StepsState {
  const [steps, setSteps] = useState<Record<string, EncryptionStep[]>>({});
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const onStep = useCallback((key: string, step: EncryptStep, context?: EncryptStepCallbackContext) => {
    if (step === EncryptStep.InitTfhe && context?.isStart) {
      // init with a single-element array
      setSteps((prev) => ({ ...prev, [key]: [{ step, context }] }));
    } else {
      setSteps((prev) => ({ ...prev, [key]: [...prev[key], { step, context }] }));
    }
  }, []);

  const onSetKey = useCallback((key: string | null) => {
    setCurrentKey(key);
  }, []);

  const compactSteps = useMemo(
    () => validateAndCompactizeSteps(currentKey ? steps[currentKey] : []),
    [steps, currentKey]
  );
  const lastStep = currentKey ? steps[currentKey][steps[currentKey].length - 1] : null;

  return {
    onStep,
    onSetKey,
    compactSteps,
    lastStep,
  };
}

async function encryptValue<T extends EncryptableItem | EncryptableArray>(
  client: CofhesdkClient | null,
  options: EncryptionOptions<T>
): Promise<EncryptedInputs<T>> {
  if (!client) throw new Error('CoFHE client not initialized');
  if (!options.input) throw new Error('Encryption options must include an input');

  const { input, onStepChange, account, chainId, securityZone } = options;

  const inputItems = (Array.isArray(input) ? input : [input]) as ArrayifyEncryptableInputs<T>;

  const encryptionBuilder = client.encryptInputs(inputItems);

  if (onStepChange) encryptionBuilder.setStepCallback(onStepChange);
  if (account) encryptionBuilder.setAccount(account);
  if (chainId) encryptionBuilder.setChainId(chainId);
  if (securityZone) encryptionBuilder.setSecurityZone(securityZone);

  const result = await encryptionBuilder.encrypt();

  if (!result.success) {
    throw result.error;
  }

  if (Array.isArray(input)) {
    return result.data as EncryptedInputs<T>;
  }
  return result.data[0] as EncryptedInputs<T>;
}

type UseMutationResultEncryptAsync<T extends EncryptableItem | EncryptableArray> = UseMutationResult<
  EncryptedInputs<T>,
  Error,
  EncryptionOptions<T>,
  unknown
>;

type UseMutationOptionsAsync<T extends EncryptableItem | EncryptableArray> = Omit<
  UseMutationOptions<EncryptedInputs<T>, Error, EncryptionOptions<T>, void>,
  'mutationFn'
>;

type UseEncryptResult<T extends EncryptableItem | EncryptableArray> = {
  encrypt: <const U extends T>(options?: EncryptionOptions<U>) => Promise<EncryptedInputs<U>>;
  data: EncryptedInputs<T> | undefined;
  error: Error | null;
  isEncrypting: boolean;
  stepsState: StepsState;
  isConnected: boolean;
  _mutation: UseMutationResultEncryptAsync<T>;
};

type EncryptionOptions<T extends EncryptableItem | EncryptableArray> = {
  input?: T;
  account?: string;
  chainId?: number;
  securityZone?: number;
  onStepChange?: (step: EncryptStep, context?: EncryptStepCallbackContext) => void;
};

export function useEncrypt<T extends EncryptableItem | EncryptableArray>(
  encryptionOptions: EncryptionOptions<T> = {},
  mutationOptions: UseMutationOptionsAsync<T> = {}
): UseEncryptResult<T> {
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep: handleStepStateChange, onSetKey: handleStepSetKey } = stepsState;

  const { onMutate, mutationKey: mutationKeyPostfix, ...restOptions } = mutationOptions;

  const mutationResult = useMutation<EncryptedInputs<T>, Error, EncryptionOptions<T>, void>({
    mutationKey: ['encryption', mutationKeyPostfix],
    onMutate: (arg1, arg2) => {
      return onMutate?.(arg1, arg2);
    },
    mutationFn: async (mutationEncryptionOptions) => {
      const key = crypto.randomUUID();
      handleStepSetKey(key);
      const mergedOptions = { ...encryptionOptions, ...mutationEncryptionOptions };

      if (!mergedOptions.input) {
        throw new Error('Encryption options must include an input');
      }

      // Forward steps to both internal and external handlers
      const combinedOnStepChange = (step: EncryptStep, context?: EncryptStepCallbackContext) => {
        handleStepStateChange(key, step, context);
        mergedOptions.onStepChange?.(step, context);
      };

      const encrypted = await encryptValue(client, {
        ...mergedOptions,
        onStepChange: combinedOnStepChange,
      });

      return encrypted;
    },
    ...restOptions,
  });

  const mutateAsync = mutationResult.mutateAsync;

  const encryptFn = useCallback(
    async <const U extends T>(options?: EncryptionOptions<U>) => {
      const variables: EncryptionOptions<T> = {
        ...options,
      };

      const encrypted = await mutateAsync(variables);
      return encrypted as EncryptedInputs<U>;
    },
    [mutateAsync]
  );

  return {
    encrypt: encryptFn,
    data: mutationResult.data,
    error: mutationResult.error,
    isEncrypting: mutationResult.isPending,
    stepsState,
    isConnected: useCofheConnection().connected,
    _mutation: mutationResult,
  };
}

// POTENTIAL FUTURE EDGE CASES:
// - user enters value to encrypt, clicks encrypt, changes value, clicks encrypt. Step state will be updated by both encrypt calls. Should only encrypt once.
//   - solved by switch to useQuery instead of useMutation?
// -

// TODO: Add tests to verify transformed types
type Test = EncryptedInputs<EncryptableBool>;
type TestArray = EncryptedInputs<[EncryptableBool, EncryptableUint8]>;

// EXAMPLE USAGE IN A COMPONENT :
const Component = () => {
  // Example 0 - single input - encryptable item
  const {
    encrypt: encrypt0,
    data: data0,
    error: error0,
  } = useEncrypt({
    input: Encryptable.bool(true),
  });

  // Example 0.5 - single input - raw data type
  const {
    encrypt: encrypt05,
    data: data05,
    error: error05,
  } = useEncrypt({
    input: { utype: FheTypes.Uint128, data: 10n },
  });

  // Example 1 - useEncrypt with no inputs, encrypt function with inputs
  // RESULT - Cannot narrow data type to [EncryptableUint128, EncryptableUint128] if no inputs are provided
  const { encrypt, data, error } = useEncrypt();

  const result1 = encrypt({
    input: [Encryptable.uint128(10n), Encryptable.uint128(10n)],
  });
  const result2 = encrypt({
    input: [Encryptable.uint128(10n), Encryptable.uint128(10n)],
  });

  // DATA will never show result from result1, will only show result from result2

  // Example 2 - useEncrypt with inputs
  // RESULT - Can narrow data type to [EncryptableUint128, EncryptableUint128] if inputs are provided
  const {
    encrypt: encrypt2,
    data: data2,
    error: error2,
  } = useEncrypt({
    input: [Encryptable.uint128(10n), Encryptable.uint128(10n)] as const,
  });

  // Example 3 - useEncrypt with no inputs but with input types included, encrypt function with inputs
  // RESULT - Can narrow data type to [EncryptableUint128, EncryptableUint128] if input types are provided
  const { encrypt: encrypt3, data: data3, error: error3 } = useEncrypt<[EncryptableUint128, EncryptableUint128]>({});

  encrypt3({
    input: [Encryptable.uint128(10n), Encryptable.uint128(10n)],
  });
  encrypt3({
    input: [Encryptable.uint128(15n), Encryptable.uint128(10n)],
  });

  // Call 1 - state 3
  // Call 2 - state 2
  // Call 1 - state 4
  // Call 2 - state 3

  const handleThing = async () => {
    const result = await encrypt3({
      input: [Encryptable.uint128(10n), Encryptable.uint128(10n)],
    });
  };
  handleThing();

  return null;
};
