import { ActionButton } from '@/components/FnxFloatingButton/components/ActionButton.js';

export const ExpirySection = <U extends string>({
  presets,
  units,
  durationSeconds,
  customCount,
  customUnit,
  selectPreset,
  setCustomUnit,
  applyCustom,
}: {
  presets: ReadonlyArray<{ label: string; seconds: number }>;
  units: ReadonlyArray<U>;
  durationSeconds: number;
  customCount: number | '';
  customUnit: U;
  selectPreset: (seconds: number) => void;
  setCustomUnit: (u: U) => void;
  applyCustom: (count: number | '', unit: U) => void;
}) => (
  <div className="space-y-3">
    <p className="text-sm font-medium fnx-text-primary">Expiring in:</p>
    <div className="grid grid-cols-3 gap-2">
      {presets.map((option) => {
        const isActive = durationSeconds === option.seconds;
        return (
          <ActionButton
            key={option.label}
            onClick={() => selectPreset(option.seconds)}
            label={option.label}
            pressed={isActive}
            className="px-3 py-2"
          />
        );
      })}
    </div>
    <div className="space-y-2">
      <p className="text-xs font-medium opacity-70">Or:</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 fnx-card-border fnx-card-bg px-3 py-2 text-sm font-medium">
          <input
            id="custom-duration-count"
            type="number"
            min={1}
            placeholder="Custom # of"
            value={customCount}
            onChange={(e) => {
              const raw = e.target.value;
              const v = raw === '' ? '' : Math.max(1, Number(raw));
              applyCustom(v, customUnit);
            }}
            className="w-full bg-transparent fnx-text-primary outline-none placeholder:opacity-50"
            aria-label="Custom duration count"
          />
        </div>
        <div className="flex items-center gap-2 fnx-card-border px-2 py-2 text-sm font-medium">
          <label htmlFor="custom-duration-unit" className="sr-only">
            Custom duration unit
          </label>
          <select
            id="custom-duration-unit"
            value={customUnit}
            onChange={(e) => setCustomUnit(e.target.value as U)}
            className="bg-transparent fnx-text-primary outline-none appearance-none pr-4"
            aria-label="Custom duration unit"
          >
            {units.map((u) => (
              <option key={u as string} value={u as string}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  </div>
);
