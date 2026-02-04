import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePermitDuration, usePermitForm } from '@/hooks/permits/index';
import PermitIcon from '@/assets/fhenix-permit-icon.svg';
import { NameSection } from '../components/NameSection';
import { ReceiverSection } from '../components/ReceiverSection';
import { ExpirySection } from '../components/ExpirySection';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import type { DelegatePermitPageProps } from './types';
import { usePortalNavigation, usePortalToasts } from '@/stores';
import { PageContainer } from '@/components/FnxFloatingButton/components/PageContainer';
import { Button } from '@/components/FnxFloatingButton/components';

export const DelegatePermitPage: React.FC<DelegatePermitPageProps> = ({ onSuccessNavigateTo, onCancel, onBack }) => {
  const { navigateBack, navigateTo, pageHistory } = usePortalNavigation();
  const { addToast } = usePortalToasts();

  const {
    permitName,
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
  } = usePermitForm({
    isDelegate: true,
    onSuccess: () => {
      // TODO: also add toast here in any case
      // by default navigate to permits list, but if arrived here from elsewhere, go back where we came from
      onSuccessNavigateTo ? onSuccessNavigateTo() : navigateTo(FloatingButtonPage.Permits);
      addToast({
        variant: 'success',
        title: 'Permit created',
        description: 'Copy and share data with recipient',
      });
    },
    onError: (error) => {
      addToast({
        variant: 'error',
        title: 'Failed to create permit',
        description: error,
      });
    },
  });
  const { presets, units, customCount, customUnit, selectPreset, setCustomCount, setCustomUnit, applyCustom } =
    usePermitDuration({ onDurationChange: setDurationSeconds, initialSeconds: durationSeconds });

  return (
      <PageContainer
        header={
          <button
            className="flex items-center gap-2 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
            type="button"
            onClick={onBack ?? navigateBack}
          >
            {(pageHistory.length > 0 || onBack) && <ArrowBackIcon fontSize="small" />}
            <span>Delegate Permit</span>
          </button>
        }
        content={
          <div className="flex flex-col w-full gap-3">
            <div className="flex items-center gap-3 text-[#0E2F3F] dark:text-white">
              <div className="flex items-center justify-center rounded-lg border border-[#0E2F3F]/30 p-2 dark:border-white/40">
                <PermitIcon className="h-7 w-7 fill-inherit" aria-label="CoFHE permit icon" />
              </div>
              <div className="text-lg font-semibold">CoFHE Permits</div>
            </div>
            <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
              Permits are used to authenticate your identity when accessing encrypted data.
              <br />
              This form generates a permit that can be copied and shared with "recipient". Recipient will be granted
              access to the signer's (your) data.
            </p>

            <NameSection permitName={permitName} error={nameError} onNameChange={handleNameChange} />
            <ReceiverSection
              receiver={receiver}
              receiverError={receiverError}
              onReceiverChange={handleReceiverChange}
            />
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
                label={isSubmitting ? 'Creating...' : 'Create Permit'}
                onClick={handleSubmit}
              />
            </div>
          </div>
        }
      />
  );
};
