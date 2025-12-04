import { useState, useCallback, useMemo } from 'react';

export type DurationUnit = 'hours' | 'days' | 'weeks' | 'months';

export interface UsePermitDurationOptions {
  onDurationChange: (seconds: number) => void;
  initialSeconds?: number;
}

export interface DurationPreset {
  label: string;
  seconds: number;
}

export interface UsePermitDurationResult {
  durationSeconds: number;
  customCount: number | '';
  customUnit: DurationUnit;
  presets: readonly DurationPreset[];
  units: readonly DurationUnit[];
  selectPreset: (seconds: number) => void;
  setCustomCount: (value: number | '') => void;
  setCustomUnit: (unit: DurationUnit) => void;
  applyCustom: (count: number | '', unit: DurationUnit) => void;
  unitSeconds: Readonly<Record<DurationUnit, number>>;
}

export function usePermitDuration(options: UsePermitDurationOptions): UsePermitDurationResult {
  const { onDurationChange, initialSeconds = 7 * 24 * 60 * 60 } = options;

  const presets: readonly DurationPreset[] = useMemo(
    () => [
      { label: '1 day', seconds: 1 * 24 * 60 * 60 },
      { label: '1 week', seconds: 7 * 24 * 60 * 60 },
      { label: '1 month', seconds: 30 * 24 * 60 * 60 },
    ],
    []
  );

  const unitSeconds: Readonly<Record<DurationUnit, number>> = useMemo(
    () => ({
      hours: 60 * 60,
      days: 24 * 60 * 60,
      weeks: 7 * 24 * 60 * 60,
      months: 30 * 24 * 60 * 60,
    }),
    []
  );

  const [durationSeconds, setDurationSecondsState] = useState(initialSeconds);
  const [customCount, setCustomCountState] = useState<number | ''>('');
  const [customUnit, setCustomUnitState] = useState<DurationUnit>('days');

  const selectPreset = useCallback(
    (seconds: number) => {
      setDurationSecondsState(seconds);
      onDurationChange(seconds);
    },
    [onDurationChange]
  );

  const applyCustom = useCallback(
    (count: number | '', unit: DurationUnit) => {
      setCustomCountState(count);
      setCustomUnitState(unit);
      if (typeof count === 'number' && count > 0) {
        const computed = count * unitSeconds[unit];
        setDurationSecondsState(computed);
        onDurationChange(computed);
      }
    },
    [unitSeconds, onDurationChange]
  );

  const setCustomCount = useCallback((value: number | '') => applyCustom(value, customUnit), [applyCustom, customUnit]);
  const setCustomUnit = useCallback((unit: DurationUnit) => applyCustom(customCount, unit), [applyCustom, customCount]);

  return {
    durationSeconds,
    customCount,
    customUnit,
    presets,
    units: ['days', 'weeks', 'months', 'hours'] as const,
    selectPreset,
    setCustomCount,
    setCustomUnit,
    applyCustom,
    unitSeconds,
  };
}
