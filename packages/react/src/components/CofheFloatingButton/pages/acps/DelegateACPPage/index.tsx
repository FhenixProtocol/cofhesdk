import { ArrowBackIcon } from '@/components/Icons';
import { useACPDuration, useACPForm } from '@/hooks/acps/index';
import ACPIcon from '@/assets/fhenix-acp-icon.svg';
import { NameSection } from '../components/NameSection';
import { ReceiverSection } from '../components/ReceiverSection';
import { ExpirySection } from '../components/ExpirySection';
import { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types';
import type { DelegateACPPageProps } from './types';
import { usePortalNavigation, usePortalToasts } from '@/stores';
import { PageContainer } from '@/components/CofheFloatingButton/components/PageContainer';
import { Button } from '@/components/CofheFloatingButton/components';

export const DelegateACPPage: React.FC<DelegateACPPageProps> = ({ onSuccessNavigateTo, onCancel, onBack }) => {
  const { navigateBack, navigateTo, pageHistory } = usePortalNavigation();
  const { addToast } = usePortalToasts();

  const {
    acpName,
    receiver,
    error,
    nameError,
    receiverError,
    isValid,
    isSubmitting,
    durationSeconds,
    handleNameChange,
    handleReceiverChange,
    setDurationSeconds,
    handleSubmit,
  } = useACPForm({
    isDelegate: true,
    onSuccess: () => {
      // TODO: also add toast here in any case
      // by default navigate to acps list, but if arrived here from elsewhere, go back where we came from
      onSuccessNavigateTo ? onSuccessNavigateTo() : navigateTo(FloatingButtonPage.ACPs);
      addToast({
        variant: 'success',
        title: 'ACP created',
        description: 'Copy and share data with recipient',
      });
    },
    onError: (error) => {
      addToast({
        variant: 'error',
        title: 'Failed to create acp',
        description: error.message,
      });
    },
  });
  const { presets, units, customCount, customUnit, selectPreset, setCustomCount, setCustomUnit, applyCustom } =
    useACPDuration({ onDurationChange: setDurationSeconds, initialSeconds: durationSeconds });

  return (
    <PageContainer
      header={
        <button
          className="flex items-center gap-2 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
          type="button"
          onClick={onBack ?? navigateBack}
        >
          {(pageHistory.length > 0 || onBack) && <ArrowBackIcon fontSize="small" />}
          <span>Delegate ACP</span>
        </button>
      }
      content={
        <div className="flex flex-col w-full gap-3">
          <div className="flex items-center gap-3 text-[#0E2F3F] dark:text-white">
            <div className="flex items-center justify-center rounded-lg border border-[#0E2F3F]/30 p-2 dark:border-white/40">
              <ACPIcon className="h-7 w-7 fill-inherit" aria-label="CoFHE acp icon" />
            </div>
            <div className="text-lg font-semibold">CoFHE ACPs</div>
          </div>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            ACPs are used to authenticate your identity when accessing encrypted data.
            <br />
            This form generates a acp that can be copied and shared with "recipient". Recipient will be granted access
            to the signer's (your) data.
          </p>

          <NameSection acpName={acpName} error={nameError} onNameChange={handleNameChange} />
          <ReceiverSection receiver={receiver} receiverError={receiverError} onReceiverChange={handleReceiverChange} />
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
        </div>
      }
      footer={
        <div className="flex flex-col w-full gap-2">
          {error && (
            <div role="alert" className="text-error">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button onClick={onCancel ?? navigateBack}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!isValid || isSubmitting}
              aria-busy={isSubmitting}
              label={isSubmitting ? 'Creating...' : 'Create ACP'}
              onClick={handleSubmit}
            />
          </div>
        </div>
      }
    />
  );
};
