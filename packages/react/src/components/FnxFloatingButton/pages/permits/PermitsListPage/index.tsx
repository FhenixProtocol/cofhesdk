import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { ElementType, FC } from 'react';
import { Accordion, AccordionSection } from '../../../Accordion.js';
import { PermitItem } from './components/PermitItem';
import { usePermitsList } from '@/hooks/permits/index.js';
import type { QuickActionId } from '@/hooks/permits/index.js';

type QuickAction = { id: QuickActionId; label: string; icon: ElementType };

const quickActions: QuickAction[] = [
  { id: 'generate', label: 'Generate / Delegate', icon: NorthIcon },
  { id: 'receive', label: 'Receive', icon: SouthIcon },
];

export const PermitsListPage: React.FC = () => {
  const {
    generatedPermits,
    receivedPermits,
    isCopied,
    handleQuickAction,
    handleCopy,
    handleDelete,
    handlePermitSelect,
    navigateBack,
  } = usePermitsList();

  return (
    <div className="fnx-text-primary space-y-4">
      <button
        type="button"
        onClick={navigateBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity mb-2"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <p className="text-sm font-medium">Permit list</p>
      </button>

      <div className="space-y-4">
        <Accordion defaultActiveId="generated">
          <AccordionSection
            id="generated"
            triggerClassName="flex w-full items-center justify-between text-left text-sm font-semibold fnx-text-primary transition-opacity hover:opacity-80"
            contentClassName="relative mt-3 pl-4"
            renderHeader={(isOpen: boolean) => (
              <>
                <span>Generated:</span>
                {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
              </>
            )}
          >
            <span
              className="absolute left-1 top-0 bottom-0 border-l fnx-card-border"
              aria-hidden
            />
            {generatedPermits.length === 0 ? (
              <div className="pl-4 text-sm opacity-70">No permits yet.</div>
            ) : (
              <div className="space-y-1.5">
                {generatedPermits.map(({ permit, hash }) => {
                  return (
                    <PermitItem key={hash} hash={hash} permit={permit} onSelect={() => handlePermitSelect(hash)}>
                      {permit.type === 'sharing' && (
                        <CopyPermitActionButton copied={isCopied(hash)} onClick={() => handleCopy(hash)} />
                      )}
                      <DeletePermitActionButton onClick={() => handleDelete(hash)} />
                    </PermitItem>
                  );
                })}
              </div>
            )}
          </AccordionSection>

          <AccordionSection
            id="received"
            triggerClassName="flex w-full items-center justify-between text-left text-sm font-semibold fnx-text-primary transition-opacity hover:opacity-80"
            contentClassName="mt-3"
            renderHeader={(isOpen: boolean) => (
              <>
                <span>Received</span>
                {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
              </>
            )}
          >
            {receivedPermits.length === 0 ? (
              <div className="pl-1 text-sm opacity-70">No permits yet.</div>
            ) : (
              <div className="space-y-1.5">
                {receivedPermits.map(({ permit, hash }) => (
                  <PermitItem key={hash} hash={hash} permit={permit} onSelect={() => handlePermitSelect(hash)}>
                    <DeletePermitActionButton onClick={() => handleDelete(hash)} />
                  </PermitItem>
                ))}
              </div>
            )}
          </AccordionSection>
        </Accordion>

        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="fnx-button flex w-full items-center justify-center gap-2 rounded-lg border fnx-card-border px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              onClick={() => handleQuickAction(id)}
            >
              <Icon fontSize="small" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const BasePermitActionButton: FC<{
  ariaLabel: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ ariaLabel, title, disabled, onClick, children }) => (
  <button
    className="rounded-md border border-[#0E2F3F]/40 p-1.5 transition-colors hover:bg-[#0E2F3F]/10 dark:border-white/40 dark:hover:bg-white/10"
    aria-label={ariaLabel}
    type="button"
    title={title ?? ariaLabel}
    disabled={Boolean(disabled)}
    onClick={onClick}
  >
    {children}
  </button>
);

const CopyPermitActionButton: FC<{ copied: boolean; onClick: () => void }> = ({ copied, onClick }) => (
  <BasePermitActionButton ariaLabel={copied ? 'Copied!' : 'Copy permit'} disabled={copied} onClick={onClick}>
    {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
  </BasePermitActionButton>
);

const DeletePermitActionButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <BasePermitActionButton ariaLabel="Remove permit" title="Remove permit" onClick={onClick}>
    <DeleteOutlineIcon fontSize="small" />
  </BasePermitActionButton>
);
