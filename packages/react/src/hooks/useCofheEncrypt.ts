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
import { useInternalQueryClient } from '../providers/index.js';

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

  if (Array.isArray(input)) {
    return result as EncryptedInputs<T>;
  }
  return result[0] as EncryptedInputs<T>;
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

export function useCofheEncrypt<T extends EncryptableItem | EncryptableArray>(
  encryptionOptions: EncryptionOptions<T> = {},
  mutationOptions: UseMutationOptionsAsync<T> = {}
): UseEncryptResult<T> {
  const qc = useInternalQueryClient();
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep: handleStepStateChange, onSetKey: handleStepSetKey } = stepsState;

  const { onMutate, mutationKey: mutationKeyPostfix, ...restOptions } = mutationOptions;

  const mutationResult = useMutation<EncryptedInputs<T>, Error, EncryptionOptions<T>, void>(
    {
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
    },
    qc
  );

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
