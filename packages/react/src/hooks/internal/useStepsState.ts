import { EncryptStep, type EncryptStepCallbackContext } from '@cofhe/sdk';
import { useCallback, useMemo, useState } from 'react';

export type EncryptionStep = { step: EncryptStep; context?: EncryptStepCallbackContext };

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
export type StepsState = {
  onStep: (key: string, step: EncryptStep, context?: EncryptStepCallbackContext) => void;
  onSetKey: (key: string | null) => void;
  compactSteps: CompactSteps;
  lastStep: EncryptionStep | null;
};

export function useStepsState(): StepsState {
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
