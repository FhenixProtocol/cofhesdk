export type NameSectionProps = {
  permitName: string;
  error?: string | null;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const NameSection: React.FC<NameSectionProps> = ({ permitName, error, onNameChange }) => (
  <div className="flex flex-col w-full gap-1">
    <div className="flex items-center justify-between text-xs font-semibold">
      <span>Name:</span>
    </div>
    <input
      id="permit-name"
      type="text"
      placeholder="Human readable name"
      value={permitName}
      onChange={onNameChange}
      className="w-full border border-[#0E2F3F]/30 outline-none p-2 placeholder:text-[#355366] dark:placeholder:text-white/60"
      aria-label="Permit name"
    />
    {error && (
      <p role="alert" className="px-4 pt-1 text-xs font-medium text-[#F0784F] dark:text-[#F0784F]">
        {error}
      </p>
    )}
  </div>
);
