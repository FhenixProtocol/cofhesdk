import { useState } from 'react';
import { LuCopy, LuCheck, LuExternalLink } from 'react-icons/lu';
import { cn } from '../../../utils/cn.js';
import {
  truncateHash,
  getBlockExplorerTxUrl,
  getBlockExplorerAddressUrl,
  getBlockExplorerTokenUrl,
} from '../../../utils/utils.js';

export type HashLinkType = 'tx' | 'address' | 'token';

interface HashLinkProps {
  type: HashLinkType;
  hash: string;
  chainId?: number;
  className?: string;
  copyable?: boolean;
  iconSize?: number;
  /** Use extra short truncation (5...3 instead of 6...4) */
  extraShort?: boolean;
}

export const HashLink: React.FC<HashLinkProps> = ({
  type,
  hash,
  chainId,
  className,
  copyable = true,
  iconSize = 14,
  extraShort = false,
}) => {
  const start = extraShort ? 5 : 6;
  const end = extraShort ? 3 : 4;
  const ellipsed = truncateHash(hash, start, end);

  const getHref = (): string | undefined => {
    if (!chainId) return undefined;
    switch (type) {
      case 'tx':
        return getBlockExplorerTxUrl(chainId, hash);
      case 'address':
        return getBlockExplorerAddressUrl(chainId, hash);
      case 'token':
        return getBlockExplorerTokenUrl(chainId, hash);
    }
  };

  const href = getHref();

  const handleClick = () => {
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {copyable && <CopyButton text={hash} size={iconSize} />}
      <button
        type="button"
        onClick={handleClick}
        disabled={!href}
        className={cn(
          'flex items-center gap-1 font-mono text-xs hover:underline',
          'fnx-text-primary opacity-60 hover:opacity-100 transition-opacity',
          !href && 'cursor-default hover:no-underline',
          className
        )}
      >
        <span>{ellipsed}</span>
        {href && <LuExternalLink style={{ width: iconSize, height: iconSize }} />}
      </button>
    </div>
  );
};

interface CopyButtonProps {
  text: string;
  size?: number;
  className?: string;
}
// TODO: This will be replaced with the new copy system from another PR
export const CopyButton: React.FC<CopyButtonProps> = ({ text, size = 14, className }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn('fnx-text-primary opacity-50 hover:opacity-100 transition-opacity cursor-pointer', className)}
      title="Copy to clipboard"
    >
      {copied ? (
        <LuCheck style={{ width: size, height: size }} className="text-green-500" />
      ) : (
        <LuCopy style={{ width: size, height: size }} />
      )}
    </button>
  );
};
