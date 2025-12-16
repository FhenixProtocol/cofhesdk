import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePermitDuration, usePermitForm } from '@/hooks/permits/index';
import { useFnxFloatingButtonContext } from '../../../FnxFloatingButtonContext';
import PermitIcon from '../assets/fhenix-permit-icon.svg';
import { NameSection } from './components/NameSection.js';
import { SelfToggle } from './components/SelfToggle.js';
import { ReceiverSection } from './components/ReceiverSection.js';
import { ExpirySection } from './components/ExpirySection.js';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import { ActionButton } from '@/components/FnxFloatingButton/components/ActionButton.js';
import type { GeneratePermitPageProps } from './types';

export const GeneratePermitPage: React.FC<GeneratePermitPageProps> = ({
  onSuccessNavigateTo,
  overridingBody,
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
    <div className="fnx-text-primary space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <button
          type="button"
          onClick={onBack ?? navigateBack}
          className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity mb-2"
        >
          {(pageHistory.length > 0 || onBack) && <ArrowBackIcon style={{ fontSize: 16 }} />}
          <p className="text-sm font-medium">Generate new permit</p>
        </button>

        {overridingBody ?? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 fnx-icon-bg flex items-center justify-center">
                <PermitIcon className="h-6 w-6" color={permitIconColor} aria-label="CoFHE permit icon" />
              </div>
              <div className="text-base font-semibold">Generate CoFHE Permit</div>
            </div>
            <p className="text-sm leading-relaxed opacity-80">
              A permit is required to authenticate your identity and grant access to your encrypted data.
            </p>
            <p className="text-sm leading-relaxed opacity-80">
              Generating a permit will open your wallet to sign a message (EIP712) which verifies your ownership of the
              connected wallet.
            </p>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-lg border border-red-500 bg-red-500/10 px-3 py-2 text-sm">
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
          <ActionButton onClick={onCancel ?? navigateBack} label="Cancel" className="py-2.5" />
          <ActionButton
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            label={isSubmitting ? 'Generating...' : 'Generate / Delegate'}
            className="py-2.5"
          />
        </div>
      </form>
    </div>
  );
};
