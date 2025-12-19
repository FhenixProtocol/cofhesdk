export type ReceiverSectionProps = {
  receiver: string;
  receiverError?: string | null;
  onReceiverChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const ReceiverSection: React.FC<ReceiverSectionProps> = ({ receiver, receiverError, onReceiverChange }) => (
  <div className="rounded-2xl border border-[#0E2F3F]/30 dark:border-white/30 overflow-hidden">
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
