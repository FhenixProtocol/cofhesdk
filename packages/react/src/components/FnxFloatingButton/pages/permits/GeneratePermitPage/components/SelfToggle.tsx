export type SelfToggleProps = {
  isSelf: boolean;
  onToggleSelf: (checked: boolean) => void;
};

export const SelfToggle: React.FC<SelfToggleProps> = ({ isSelf, onToggleSelf }) => (
  <label
    htmlFor="self-permit"
    className="flex items-center gap-2 text-sm font-medium text-[#0E2F3F] dark:text-white cursor-pointer"
  >
    <span>Self permit</span>
    <input
      id="self-permit"
      type="checkbox"
      className="h-4 w-4 accent-[#0E2F3F] dark:accent-white"
      checked={isSelf}
      onChange={(e) => onToggleSelf(e.target.checked)}
      aria-label="Self permit"
    />
  </label>
);
