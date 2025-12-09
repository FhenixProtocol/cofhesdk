import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PermitReceiveIcon from '../assets/fhenix-permit-receive.svg';
import { useFnxFloatingButtonContext } from '../../../FnxFloatingButtonContext.js';
import { useReceivePermit } from '@/hooks/permits/index.js';

export const ReceivePermitPage: React.FC = () => {
  const { navigateBack, darkMode } = useFnxFloatingButtonContext();
  const { permitData, setPermitData, permitName, setPermitName, isSubmitting, errorMsg, successMsg, submit } =
    useReceivePermit(() => navigateBack());
  const permitIconColor = darkMode ? '#FFFFFF' : '#00314E';

  return (
    <div className="fnx-text-primary space-y-4">
      <button
        type="button"
        onClick={navigateBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity mb-2"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <p className="text-sm font-medium">Receive permit</p>
      </button>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg fnx-icon-bg border fnx-card-border flex items-center justify-center">
            <PermitReceiveIcon color={permitIconColor} />
          </div>
          <div className="text-base font-semibold">Receive CoFHE Permit</div>
        </div>
        <div className="space-y-2 opacity-80">
          <p className="text-sm leading-relaxed">
            A permit is required to authenticate your identity and grant access to your encrypted data.
          </p>
          <p className="text-sm leading-relaxed">
            Receiving a permit will open your wallet to sign a message. Once signed your wallet is granted access.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fnx-permit-data">
            Permit data:
          </label>
          <textarea
            id="fnx-permit-data"
            rows={3}
            placeholder="Paste permit data"
            className="w-full rounded-lg border fnx-card-border fnx-card-bg px-3 py-2 text-sm fnx-text-primary outline-none transition focus:opacity-100"
            value={permitData}
            onChange={(e) => setPermitData(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fnx-permit-name">
            Name:
          </label>
          <input
            id="fnx-permit-name"
            type="text"
            placeholder="Add a permit name (optional)"
            className="w-full rounded-lg border fnx-card-border fnx-card-bg px-3 py-2 text-sm fnx-text-primary outline-none transition focus:opacity-100"
            value={permitName}
            onChange={(e) => setPermitName(e.target.value)}
          />
        </div>
        {errorMsg && <div className="text-red-500 text-sm">{errorMsg}</div>}
        {successMsg && <div className="text-green-500 text-sm">{successMsg}</div>}
      </section>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          className="fnx-button rounded-lg py-2.5 text-sm font-medium border fnx-card-border hover:opacity-80 transition-opacity"
          onClick={navigateBack}
        >
          Cancel
        </button>
        <button
          type="button"
          className="fnx-send-button fnx-send-button-enabled rounded-lg py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
          disabled={isSubmitting}
          onClick={submit}
        >
          {isSubmitting ? 'Signing...' : 'Sign Permit'}
        </button>
      </div>
    </div>
  );
};
