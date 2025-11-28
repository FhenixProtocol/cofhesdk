import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext.js';

type PermitStatus = 'active' | 'expired';

interface PermitRow {
  id: string;
  name: string;
  status: PermitStatus;
  actions: Array<'copy' | 'delete' | 'refresh'>;
}

const generatedPermits: PermitRow[] = [
  { id: 'default', name: 'Default', status: 'active', actions: ['delete'] },
  { id: 'rogue', name: 'Rogue {revocable}', status: 'active', actions: ['copy', 'delete'] },
  { id: 'yonatan', name: 'Yonatan', status: 'active', actions: ['copy', 'delete'] },
  { id: 'placeholder-1', name: '{Permit name}', status: 'expired', actions: ['refresh', 'delete'] },
  { id: 'placeholder-2', name: '{Permit name}', status: 'expired', actions: ['refresh', 'delete'] },
];

const actionIconMap = {
  copy: ContentCopyIcon,
  delete: DeleteOutlineIcon,
  refresh: AutorenewIcon,
};

const actionLabels = {
  copy: 'Copy permit',
  delete: 'Remove permit',
  refresh: 'Regenerate permit',
};

const statusStyles: Record<PermitStatus, string> = {
  active: 'bg-[#01D082] text-[#0D3547] border border-[#068571]',
  expired: 'bg-[#F0784F] text-[#4A1004] border border-[#A1421F]',
};

const quickActions = [
  {
    id: 'generate',
    label: 'Generate / Delegate',
    icon: NorthIcon,
  },
  {
    id: 'receive',
    label: 'Receive',
    icon: SouthIcon,
  },
];

export const PermitsPage: React.FC = () => {
  const { navigateBack, navigateToGeneratePermit, navigateToReceivePermit } = useFnxFloatingButtonContext();

  const handleQuickAction = (actionId: string) => {
    if (actionId === 'generate') {
      navigateToGeneratePermit();
      return;
    }
    if (actionId === 'receive') {
      navigateToReceivePermit();
    }
  };

  return (
    <div className="fnx-text-primary text-sm">
      <div className="rounded-2xl border border-[#154054] bg-white p-5 shadow-[0_25px_60px_rgba(13,53,71,0.15)] transition-colors dark:border-[#2C6D80] dark:bg-[#1F1F1F]">
        <div className="flex items-center justify-between pb-4">
          <button
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
            onClick={navigateBack}
            type="button"
          >
            <ArrowBackIcon fontSize="small" />
            <span>Permit list</span>
          </button>
        </div>

        <div className="space-y-6 pt-2">
          <section>
            <div className="flex items-center justify-between text-base font-semibold text-[#0E2F3F] dark:text-white">
              <span>Generated:</span>
              <KeyboardArrowUpIcon fontSize="small" />
            </div>
            <div className="relative mt-4 pl-4">
              <span className="absolute left-1 top-0 bottom-0 border-l border-[#0E2F3F]/30 dark:border-white/40" aria-hidden />
              <div className="space-y-1.5">
                {generatedPermits.map((permit) => (
                  <div key={permit.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 pl-4">
                    <span className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-semibold ${statusStyles[permit.status]}`}>
                      {permit.status === 'active' ? 'Active' : 'Expired'}
                    </span>
                    <span className="text-base font-medium text-[#0E2F3F] dark:text-white">{permit.name}</span>
                    <div className="flex items-center gap-2 text-[#0E2F3F] dark:text-white">
                      {permit.actions.map((action) => {
                        const Icon = actionIconMap[action];
                        return (
                          <button
                            key={action}
                            className="rounded-md border border-[#0E2F3F]/40 p-1.5 transition-colors hover:bg-[#0E2F3F]/10 dark:border-white/40 dark:hover:bg-white/10"
                            aria-label={actionLabels[action]}
                            type="button"
                          >
                            <Icon fontSize="small" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between text-base font-semibold text-[#0E2F3F] dark:text-white">
              <span>Received</span>
              <KeyboardArrowDownIcon fontSize="small" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {quickActions.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0E2F3F] px-4 py-3 text-base font-semibold text-[#0E2F3F] transition-colors hover:bg-[#0E2F3F]/5 dark:border-white/60 dark:text-white dark:hover:bg-white/5"
                  onClick={() => handleQuickAction(id)}
                >
                  <Icon fontSize="small" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
