export type ReceiverSectionProps = {
  receiver: string;
  receiverError?: string | null;
  onReceiverChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const ReceiverSection: React.FC<ReceiverSectionProps> = ({ receiver, receiverError, onReceiverChange }) => (
  <div className="flex flex-col w-full gap-1">
    <div className="flex items-center justify-between text-xs font-semibold">
      <span>Receiver:</span>
    </div>
    <input
      id="receiver-address"
      type="text"
      placeholder="Receiver address (0x...)"
      value={receiver}
      onChange={onReceiverChange}
      className="w-full border border-[#0E2F3F]/30 outline-none p-2 placeholder:text-[#355366] dark:placeholder:text-white/60"
      aria-label="Receiver address"
    />
    {receiverError && (
      <p role="alert" className="text-xs font-medium text-[#F0784F] dark:text-[#F0784F]">
        {receiverError}
      </p>
    )}
  </div>
);
