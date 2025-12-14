import { useState } from 'react';
import { MdContentCopy, MdCheck } from 'react-icons/md';
import { cn } from '../../../utils/cn.js';
import { truncateAddress } from '../../../utils/utils.js';

interface AddressButtonProps {
  address: string | null | undefined;
  className?: string;
  icon?: React.ReactNode;
  showCopyIcon?: boolean;
  /** When true, renders the full address instead of a truncated version */
  showFullAddress?: boolean;
}

export const AddressButton: React.FC<AddressButtonProps> = ({
  address,
  className,
  icon,
  showCopyIcon = true,
  showFullAddress = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const displayAddress = address ? address : 'Not connected';
  const truncatedAddress = truncateAddress(address) || displayAddress;
  const label = showFullAddress ? displayAddress : truncatedAddress;

  return (
    <button
      onClick={handleCopyAddress}
      disabled={!address}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded fnx-hover-overlay transition-colors',
        'fnx-text-primary text-sm',
        className
      )}
    >
      {icon}
      <span className="font-mono">{label}</span>
      {showCopyIcon && address && (copied ? <MdCheck className="w-3 h-3" /> : <MdContentCopy className="w-3 h-3" />)}
      {copied && !showCopyIcon && <span className="text-xs opacity-70">Copied!</span>}
    </button>
  );
};
