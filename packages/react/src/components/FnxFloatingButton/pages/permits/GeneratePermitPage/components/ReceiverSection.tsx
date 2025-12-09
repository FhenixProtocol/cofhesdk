import React from 'react';

export type ReceiverSectionProps = {
  receiver: string;
  receiverError?: string | null;
  onReceiverChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const ReceiverSection: React.FC<ReceiverSectionProps> = ({ receiver, receiverError, onReceiverChange }) => (
  <div className="rounded-lg border fnx-card-border overflow-hidden">
    <div className="flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide opacity-70">
      <span>Receiver</span>
    </div>
    <div className="border-t fnx-card-border fnx-card-bg px-3 py-2.5 text-sm font-medium">
      <input
        id="receiver-address"
        type="text"
        placeholder="Receiver address (0x...)"
        value={receiver}
        onChange={onReceiverChange}
        className="w-full bg-transparent fnx-text-primary outline-none placeholder:opacity-50"
        aria-label="Receiver address"
      />
    </div>
    {receiverError && (
      <p role="alert" className="px-3 pt-1 text-xs font-medium text-red-500">
        {receiverError}
      </p>
    )}
  </div>
);
