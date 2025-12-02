import React from 'react';

export type NameSectionProps = {
  permitName: string;
  error?: string | null;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  headerRight?: React.ReactNode;
};

export const NameSection: React.FC<NameSectionProps> = ({ permitName, error, onNameChange, headerRight }) => (
  <div className="rounded-2xl border border-[#0E2F3F]/30 dark:border-white/30 overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#0E2F3F]/70 dark:text-white/70">
      <span>Name</span>
      {headerRight}
    </div>
    <div className="border-t border-[#0E2F3F]/15 bg-[#F4F6F8] px-4 py-3 text-base font-semibold text-[#0E2F3F] dark:border-white/15 dark:bg-transparent dark:text-white">
      <input
        id="permit-name"
        type="text"
        placeholder="Permit name"
        value={permitName}
        onChange={onNameChange}
        className="w-full bg-transparent outline-none placeholder:text-[#355366] dark:placeholder:text-white/60"
        aria-label="Permit name"
      />
    </div>
    {error && (
      <p role="alert" className="px-4 pt-1 text-xs font-medium text-[#F0784F] dark:text-[#F0784F]">
        {error}
      </p>
    )}
  </div>
);
