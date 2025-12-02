import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { usePermitForm } from './usePermitForm.js';
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext.js';
import PermitIcon from './assets/fhenix-permit-icon.svg';
import clsx from 'clsx';
import { usePermitDuration } from './usePermitDuration.js';

type NameSectionProps = {
  permitName: string;
  error?: string | null;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  headerRight?: React.ReactNode;
};

const NameSection: React.FC<NameSectionProps> = ({ permitName, error, onNameChange, headerRight }) => (
  <div className="rounded-2xl border border-[#0E2F3F]/30 dark:border-white/30">
    <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#0E2F3F]/70 dark:text-white/70">
      <span>Name</span>
      {headerRight}
    </div>
    <div className="border-t border-[#0E2F3F]/15 bg-[#F4F6F8] px-4 py-3 text-base font-semibold text-[#0E2F3F] dark:border-white/15 dark:bg-transparent dark:text-white">
      <input
        id="permit-name"
        type="text"
        placeholder="Permit name"
        value={permitName}
        onChange={onNameChange}
        className="w-full bg-transparent outline-none placeholder:text-[#355366] dark:placeholder:text-white/60"
        aria-label="Permit name"
      />
    </div>
    {error && (
      <p role="alert" className="px-4 pt-1 text-xs font-medium text-[#F0784F] dark:text-[#F0784F]">
        {error}
      </p>
    )}
  </div>
);

type SelfToggleProps = {
  isSelf: boolean;
  onToggleSelf: (checked: boolean) => void;
};

const SelfToggle: React.FC<SelfToggleProps> = ({ isSelf, onToggleSelf }) => (
  <label
    htmlFor="self-permit"
    className="flex items-center gap-2 text-sm font-medium text-[#0E2F3F] dark:text-white cursor-pointer"
  >
    <span>Self permit</span>
    <input
      id="self-permit"
      type="checkbox"
      className="h-4 w-4 accent-[#0E2F3F] dark:accent-white"
      checked={isSelf}
      onChange={(e) => onToggleSelf(e.target.checked)}
      aria-label="Self permit"
    />
  </label>
);

type ReceiverSectionProps = {
  receiver: string;
  receiverError?: string | null;
  onReceiverChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const ReceiverSection: React.FC<ReceiverSectionProps> = ({ receiver, receiverError, onReceiverChange }) => (
  <div className="rounded-2xl border border-[#0E2F3F]/30 dark:border-white/30">
    <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#0E2F3F]/70 dark:text-white/70">
      <span>Receiver</span>
    </div>
    <div className="border-t border-[#0E2F3F]/15 bg-[#F4F6F8] px-4 py-3 text-base font-semibold text-[#0E2F3F] dark:border-white/15 dark:bg-transparent dark:text-white">
      <input
        id="receiver-address"
        type="text"
        placeholder="Receiver address (0x...)"
        value={receiver}
        onChange={onReceiverChange}
        className="w-full bg-transparent outline-none placeholder:text-[#355366] dark:placeholder:text-white/60"
        aria-label="Receiver address"
      />
    </div>
    {receiverError && (
      <p role="alert" className="px-4 pt-1 text-xs font-medium text-[#F0784F] dark:text-[#F0784F]">
        {receiverError}
      </p>
    )}
  </div>
);

const ExpirySection = <U extends string>({
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
          <KeyboardArrowDownIcon fontSize="small" />
        </div>
      </div>
    </div>
  </div>
);

export const GeneratePermitPage: React.FC = () => {
  const { navigateToPermits, navigateBack, darkMode } = useFnxFloatingButtonContext();
  const permitIconColor = darkMode ? '#FFFFFF' : '#00314E';

  const {
    permitName,
    receiver,
    isSelf,
    error,
    receiverError,
    isValid,
    isSubmitting,
    durationSeconds,
    handleNameChange,
    handleReceiverChange,
    toggleIsSelf,
    setDurationSeconds,
    handleSubmit,
  } = usePermitForm({
    onSuccess: navigateToPermits, // TODO: also add toast here?
  });
  const { presets, units, customCount, customUnit, selectPreset, setCustomCount, setCustomUnit, applyCustom } =
    usePermitDuration({ onDurationChange: setDurationSeconds, initialSeconds: durationSeconds });

  return (
    <div className="fnx-text-primary text-sm">
      <form
        className="space-y-5 rounded-2xl border border-[#154054] bg-white p-5 shadow-[0_25px_60px_rgba(13,53,71,0.12)] transition-colors dark:border-[#2C6D80] dark:bg-[#1F1F1F]"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <button
          className="flex items-center gap-2 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
          type="button"
          onClick={navigateBack}
        >
          <ArrowBackIcon fontSize="small" />
          <span>Generate new permit</span>
        </button>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[#0E2F3F] dark:text-white">
            <div className="flex items-center justify-center rounded-lg border border-[#0E2F3F]/30 p-2 dark:border-white/40">
              <PermitIcon className="h-7 w-7" color={permitIconColor} aria-label="CoFHE permit icon" />
            </div>
            <div className="text-lg font-semibold">Generate CoFHE Permit</div>
          </div>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            A permit is required to authenticate your identity and grant access to your encrypted data.
          </p>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            Generating a permit will open your wallet to sign a message (EIP712) which verifies your ownership of the
            connected wallet.
          </p>
        </div>

        <section className="space-y-3">
          <NameSection
            permitName={permitName}
            error={error}
            onNameChange={handleNameChange}
            headerRight={<SelfToggle isSelf={isSelf} onToggleSelf={toggleIsSelf} />}
          />

          {!isSelf && (
            <ReceiverSection
              receiver={receiver}
              receiverError={receiverError}
              onReceiverChange={handleReceiverChange}
            />
          )}

          <ExpirySection
            presets={presets}
            units={units}
            durationSeconds={durationSeconds}
            customCount={customCount}
            customUnit={customUnit}
            selectPreset={selectPreset}
            setCustomUnit={setCustomUnit}
            applyCustom={applyCustom}
          />
        </section>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            className="rounded-xl border border-[#F0784F] bg-[#F0784F] py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 dark:border-[#C8542D] dark:bg-[#C8542D]"
            onClick={navigateBack}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            aria-busy={isSubmitting}
            className={`rounded-xl border border-[#0EA5A7] bg-[#6ED8E1] py-3 text-base font-semibold text-[#0E2F3F] transition-opacity dark:border-[#0EA5A7] dark:bg-[#0EA5A7] dark:text-white ${
              isValid && !isSubmitting ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Generating…' : 'Generate / Delegate'}
          </button>
        </div>
      </form>
    </div>
  );
};
