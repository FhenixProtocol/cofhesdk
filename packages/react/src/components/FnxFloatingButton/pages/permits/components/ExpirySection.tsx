import { Button } from '@/components/FnxFloatingButton/components';

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
  <div className="flex flex-col w-full gap-2">
    <div className="flex items-center justify-between text-xs font-semibold">
      <span>Expiration:</span>
    </div>
    <div className="grid grid-cols-3 gap-3">
      {presets.map((option) => {
        const isActive = durationSeconds === option.seconds;
        return (
          <Button
            key={option.label}
            variant={isActive ? 'primary' : 'default'}
            onClick={() => selectPreset(option.seconds)}
            label={option.label}
          />
        );
      })}
    </div>

    {/* TODO: Re-enable custom duration input */}
    {/* <p className="text-base font-semibold text-[#0E2F3F] dark:text-white">- or -</p>
    <div className="flex flex-row w-full items-center gap-3">
      <div className="flex-1">
        <input
          id="custom-duration-count"
          type="number"
          min={1}
          placeholder="#"
          value={customCount}
          onChange={(e) => {
            const raw = e.target.value;
            const v = raw === '' ? '' : Math.max(1, Number(raw));
            applyCustom(v, customUnit);
          }}
          className="border border-[#0E2F3F]/30 outline-none p-2 placeholder:text-[#355366] dark:placeholder:text-white/60"
          aria-label="Custom duration count"
        />
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-[#0E2F3F]/40 px-3 py-2 text-base font-semibold text-[#0E2F3F] dark:border-white/40 dark:text-white">
        <div className="flex-1">
          <label htmlFor="custom-duration-unit" className="sr-only">
            Custom duration unit
          </label>
        </div>
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
    </div> */}
  </div>
);
