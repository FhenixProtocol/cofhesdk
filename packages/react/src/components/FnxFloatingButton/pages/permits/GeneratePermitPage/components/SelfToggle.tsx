import React from 'react';

export type SelfToggleProps = {
  isSelf: boolean;
  onToggleSelf: (checked: boolean) => void;
};

export const SelfToggle: React.FC<SelfToggleProps> = ({ isSelf, onToggleSelf }) => (
  <label htmlFor="self-permit" className="flex items-center gap-2 text-sm font-medium fnx-text-primary cursor-pointer">
    <span>Self permit</span>
    <input
      id="self-permit"
      type="checkbox"
      className="h-4 w-4"
      checked={isSelf}
      onChange={(e) => onToggleSelf(e.target.checked)}
      aria-label="Self permit"
    />
  </label>
);
