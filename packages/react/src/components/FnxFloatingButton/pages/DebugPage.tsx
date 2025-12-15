import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import {
  ErrorToastPrimitive,
  InfoToastPrimitive,
  SuccessToastPrimitive,
  WarningToastPrimitive,
} from '../components/ToastPrimitives.js';

export const DebugPage: React.FC = () => {
  const { navigateBack, addToast } = useFnxFloatingButtonContext();

  return (
    <div className="fnx-text-primary space-y-3">
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Debug</p>
        <p className="text-xs">Toasts:</p>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              content: (
                <InfoToastPrimitive
                  id={id}
                  title="This toast won't go away on its own"
                  description="Click the X to dismiss it"
                />
              ),
            });
          }}
        >
          Non-expiring Toast
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              duration: 3000,
              content: (
                <InfoToastPrimitive
                  id={id}
                  title="Info toast"
                  description="This is an info toast"
                  transaction={{ hash: '0x123', chainId: 1 }}
                />
              ),
            });
          }}
        >
          Info Toast (via component)
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              duration: 3000,
              content: (
                <SuccessToastPrimitive
                  id={id}
                  title="Success toast"
                  description="This is a success toast"
                  transaction={{ hash: '0x123', chainId: 1 }}
                />
              ),
            });
          }}
        >
          Success Toast (via component)
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              duration: 3000,
              content: (
                <ErrorToastPrimitive
                  id={id}
                  title="Error toast"
                  description="This is an error toast"
                  transaction={{ hash: '0x123', chainId: 1 }}
                />
              ),
            });
          }}
        >
          Error Toast (via component)
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              duration: 3000,
              content: (
                <WarningToastPrimitive
                  id={id}
                  title="Warning toast"
                  description="This is a warning toast"
                  transaction={{ hash: '0x123', chainId: 1 }}
                />
              ),
            });
          }}
        >
          Warning Toast (via component)
        </button>
      </div>
    </div>
  );
};
