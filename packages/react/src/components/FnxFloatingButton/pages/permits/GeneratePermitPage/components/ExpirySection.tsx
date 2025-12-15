import clsx from 'clsx';

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
  <div className="space-y-4">
    <p className="text-base font-semibold text-[#0E2F3F] dark:text-white">Expiring in:</p>
    <div className="grid grid-cols-3 gap-3">
      {presets.map((option) => {
        const isActive = durationSeconds === option.seconds;
        const base = 'rounded-xl border px-4 py-3 text-base font-semibold transition-colors';
        const active =
          'border-[#0E2F3F] bg-[#0E2F3F]/10 text-[#0E2F3F] dark:border-white dark:bg-white/10 dark:text-white';
        const inactive =
          'border-[#0E2F3F] text-[#0E2F3F] hover:bg-[#0E2F3F]/5 dark:border-white/50 dark:text-white dark:hover:bg-white/10';
        return (
          <button
            key={option.label}
            type="button"
            className={clsx(base, isActive ? active : inactive)}
            onClick={() => selectPreset(option.seconds)}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[#0E2F3F] dark:text-white">Or:</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 rounded-xl border border-[#0E2F3F]/40 bg-[#F4F6F8] px-4 py-3 text-base font-semibold text-[#0E2F3F] dark:border-white/30 dark:bg-transparent dark:text-white">
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
            className="w-full bg-transparent outline-none placeholder:text-[#355366] dark:placeholder:text-white/60"
            aria-label="Custom duration count"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#0E2F3F]/40 px-3 py-2 text-base font-semibold text-[#0E2F3F] dark:border-white/40 dark:text-white">
          <label htmlFor="custom-duration-unit" className="sr-only">
            Custom duration unit
          </label>
          <select
            id="custom-duration-unit"
            value={customUnit}
            onChange={(e) => setCustomUnit(e.target.value as U)}
            className="bg-transparent outline-none appearance-none pr-5"
            aria-label="Custom duration unit"
          >
            {units.map((u) => (
              <option key={u as string} value={u as string} className="text-[#0E2F3F]">
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  </div>
);
