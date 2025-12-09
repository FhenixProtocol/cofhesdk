import React from 'react';

export type NameSectionProps = {
  permitName: string;
  error?: string | null;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  headerRight?: React.ReactNode;
};

export const NameSection: React.FC<NameSectionProps> = ({ permitName, error, onNameChange, headerRight }) => (
  <div className="rounded-lg border fnx-card-border overflow-hidden">
    <div className="flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide opacity-70">
      <span>Name</span>
      {headerRight}
    </div>
    <div className="border-t fnx-card-border fnx-card-bg px-3 py-2.5 text-sm font-medium">
      <input
        id="permit-name"
        type="text"
        placeholder="Permit name"
        value={permitName}
        onChange={onNameChange}
        className="w-full bg-transparent fnx-text-primary outline-none placeholder:opacity-50"
        aria-label="Permit name"
      />
    </div>
    {error && (
      <p role="alert" className="px-3 pt-1 text-xs font-medium text-red-500">
        {error}
      </p>
    )}
  </div>
);
