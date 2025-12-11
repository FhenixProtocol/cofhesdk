import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePermitDuration, usePermitForm } from '@/hooks/permits/index';
import { useFnxFloatingButtonContext } from '../../../FnxFloatingButtonContext';
import PermitIcon from '../assets/fhenix-permit-icon.svg';
import { NameSection } from './components/NameSection';
import { SelfToggle } from './components/SelfToggle';
import { ReceiverSection } from './components/ReceiverSection';
import { ExpirySection } from './components/ExpirySection';
import type { ReactNode } from 'react';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';

export type GeneratePermitPageProps = {
  onSuccessNavigateTo?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  headerMessage?: ReactNode;
};
export const GeneratePermitPage: React.FC<GeneratePermitPageProps> = ({
  onSuccessNavigateTo,
  headerMessage,
  onCancel,
  onBack,
}) => {
  const { navigateBack, darkMode, navigateTo, pageHistory } = useFnxFloatingButtonContext();
  const permitIconColor = darkMode ? '#FFFFFF' : '#00314E';

  const {
    permitName,
    receiver,
    isSelf,
    error,
    nameError,
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
    onSuccess: () => {
      // TODO: also add toast here in any case
      // by default navigate to permits list, but if arrived here from elsewhere, go back where we came from
      onSuccessNavigateTo ? onSuccessNavigateTo() : navigateTo(FloatingButtonPage.Permits);
    },
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
          onClick={onBack ?? navigateBack}
        >
          {(pageHistory.length > 0 || onBack) && <ArrowBackIcon fontSize="small" />}
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
        {headerMessage}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[#F0784F] bg-[#F0784F]/10 px-4 py-3 text-sm font-medium text-[#0E2F3F] dark:border-[#C8542D] dark:bg-[#C8542D]/15 dark:text-white"
          >
            {error}
          </div>
        )}

        <section className="space-y-3">
          <NameSection
            permitName={permitName}
            error={nameError}
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
            onClick={onCancel ?? navigateBack}
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
