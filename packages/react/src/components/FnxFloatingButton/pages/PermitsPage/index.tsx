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
  active: 'bg-emerald-300 text-emerald-900 border border-emerald-500/60',
  expired: 'bg-[#F8B59D] text-[#5B1F0F] border border-[#E88D6E]',
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
  const { navigateBack } = useFnxFloatingButtonContext();

  return (
    <div>
      <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_25px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
          <button
            className="flex items-center gap-2 text-sm font-semibold tracking-tight transition-opacity hover:opacity-80"
            onClick={navigateBack}
            type="button"
          >
            <ArrowBackIcon fontSize="small" />
            <span>Permit list</span>
          </button>
        </div>

        <div className="space-y-5 pt-4">
          <div>
            <div className="flex items-center justify-between text-[13px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <span>Generated:</span>
              <KeyboardArrowUpIcon fontSize="small" />
            </div>

            <div className="relative mt-3 pl-4">
              <span
                className="absolute left-1 top-0 bottom-0 border-l border-slate-200 dark:border-slate-700"
                aria-hidden
              />
              <div className="space-y-2">
                {generatedPermits.map((permit) => (
                  <div
                    key={permit.id}
                    className="grid grid-cols-[minmax(0,_120px)_1fr_min-content] items-center gap-3 rounded-xl bg-white/60 px-3 py-2 text-[13px] shadow-sm dark:bg-white/5"
                  >
                    <span
                      className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold ${statusStyles[permit.status]}`}
                    >
                      {permit.status === 'active' ? 'Active' : 'Expired'}
                    </span>
                    <span className="text-sm font-medium">{permit.name}</span>
                    <div className="flex items-center gap-2 text-slate-500">
                      {permit.actions.map((action) => {
                        const Icon = actionIconMap[action];
                        return (
                          <button
                            key={action}
                            className="rounded-lg border border-slate-200 bg-white/80 p-1 transition-colors hover:border-slate-400 hover:text-slate-700 dark:border-white/20 dark:bg-slate-900 dark:hover:border-white/40"
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
          </div>

          <div>
            <div className="flex items-center justify-between text-[13px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <span>Received</span>
              <KeyboardArrowDownIcon fontSize="small" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {quickActions.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-4 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:border-white/20 dark:bg-white/5 dark:text-white"
                >
                  <Icon fontSize="small" className="text-slate-500 dark:text-slate-300" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
