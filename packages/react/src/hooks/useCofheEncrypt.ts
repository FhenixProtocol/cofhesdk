import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import {
  assertCorrectEncryptedItemInput,
  EncryptStep,
  type EncryptableItem,
  type EncryptedItemInput,
  type EncryptStepCallbackContext,
  type EncryptedItemInputs,
  isLastEncryptionStep,
} from '@cofhe/sdk';
import { assert } from 'ts-essentials';
import { useStepsState, type EncryptionStep, type StepsState } from './internal/useStepsState';
import { useInternalMutation } from '../providers/index.js';
import { useCofheContext } from '../providers/index.js';
export type EncryptableArray = readonly EncryptableItem[];
export type EncryptionOptions<T extends EncryptableItem | EncryptableArray> = {
  input?: T;
  account?: string;
  chainId?: number;
  securityZone?: number; // TODO: potential conflifct/ambiguity with createEncryptable arg - figure it out
  onStepChange?: (step: EncryptStep, context?: EncryptStepCallbackContext) => void;
};

type StepConfig = { label: string; progress: number };
const STEP_CONFIG: Record<EncryptStep, StepConfig> = {
  initTfhe: {
    label: 'Initializing TFHE...',
    progress: 5,
  },
  fetchKeys: {
    label: 'Fetching FHE keys...',
    progress: 20,
  },
  pack: {
    label: 'Packing data...',
    progress: 40,
  },
  prove: {
    label: 'Generating proof...',
    progress: 70,
  },
  verify: {
    label: 'Verifying...',
    progress: 90,
  },
};

const DONE_STEP_CONFIG: StepConfig = {
  label: 'Encryption complete!',
  progress: 100,
};

export function getStepConfig(step: EncryptionStep) {
  if (isLastEncryptionStep(step.step) && step.context?.isEnd) return DONE_STEP_CONFIG;

  return STEP_CONFIG[step.step];
}
type EncryptInputsResult<T extends readonly EncryptableItem[]> = EncryptedItemInputs<[...T]>;

export type EncryptInputsOptions = {
  account?: string;
  chainId?: number;
  securityZone?: number;
  onStepChange?: (step: EncryptStep, context?: EncryptStepCallbackContext) => void;
};

export type EncryptInputsVariables<T extends readonly EncryptableItem[] = readonly EncryptableItem[]> =
  | T
  | ({
      items: T;
    } & EncryptInputsOptions);

function hasEncryptInputsOptions<T extends readonly EncryptableItem[]>(
  variables: EncryptInputsVariables<T>
): variables is { items: T } & EncryptInputsOptions {
  return typeof variables === 'object' && variables !== null && 'items' in variables;
}

function assertEncryptInputsResult<T extends readonly EncryptableItem[]>(
  inputs: T,
  encrypted: readonly EncryptedItemInput[]
): asserts encrypted is EncryptInputsResult<T> {
  if (encrypted.length !== inputs.length) {
    throw new Error(`Encryption result length mismatch (expected ${inputs.length}, got ${encrypted.length})`);
  }

  for (let i = 0; i < encrypted.length; i++) {
    const encryptedItem = encrypted[i];
    const inputItem = inputs[i];

    assertCorrectEncryptedItemInput(encryptedItem);

    if (encryptedItem.utype !== inputItem.utype) {
      throw new Error(`Encryption result type mismatch at index ${i}`);
    }
  }
}

export type useCofheEncryptNewOptions = Omit<
  UseMutationOptions<readonly EncryptedItemInput[], Error, EncryptInputsVariables, void>,
  'mutationFn'
>;

/**
 * Low-level mutation hook: encrypt a list of EncryptableItems into encrypted input structs.
 *
 */
export function useCofheEncrypt(options?: useCofheEncryptNewOptions): UseMutationResult<
  readonly EncryptedItemInput[],
  Error,
  EncryptInputsVariables,
  void
> & {
  encryptInputsAsync: <const T extends readonly EncryptableItem[]>(
    variables: EncryptInputsVariables<T>
  ) => Promise<EncryptInputsResult<T>>;
  encryptInputs: (variables: EncryptInputsVariables) => void;
  isEncrypting: boolean;
  stepsState: StepsState;
} {
  const client = useCofheContext().client;
  const stepsState = useStepsState();
  const { onStep: handleStepStateChange, onSetKey: handleStepSetKey } = stepsState;

  const mutation = useInternalMutation<readonly EncryptedItemInput[], Error, EncryptInputsVariables, void>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'encryptInputs'],
    mutationFn: async (variables) => {
      assert(client, 'CoFHE client not initialized');

      const key = crypto.randomUUID();
      handleStepSetKey(key);

      const items = hasEncryptInputsOptions(variables) ? variables.items : variables;
      // SDK expects a mutable array type; copy preserves runtime value while satisfying typing.
      const mutableItems = Array.from(items);

      const builder = client.encryptInputs(mutableItems);

      const externalOnStepChange = hasEncryptInputsOptions(variables) ? variables.onStepChange : undefined;

      const combinedOnStepChange = (step: EncryptStep, context?: EncryptStepCallbackContext) => {
        handleStepStateChange(key, step, context);
        externalOnStepChange?.(step, context);
      };

      // Always set callback so we can track steps consistently.
      builder.setStepCallback(combinedOnStepChange);

      if (hasEncryptInputsOptions(variables)) {
        if (variables.account) builder.setAccount(variables.account);
        if (variables.chainId) builder.setChainId(variables.chainId);
        if (variables.securityZone) builder.setSecurityZone(variables.securityZone);
      }

      return builder.encrypt();
    },
  });

  return {
    ...mutation,
    encryptInputsAsync: async <const T extends readonly EncryptableItem[]>(variables: EncryptInputsVariables<T>) => {
      const items = hasEncryptInputsOptions(variables) ? variables.items : variables;
      const result = await mutation.mutateAsync(variables);
      assertEncryptInputsResult(items, result);
      return result;
    },
    encryptInputs: (variables) => mutation.mutate(variables),
    isEncrypting: mutation.isPending,
    stepsState,
  };
}
