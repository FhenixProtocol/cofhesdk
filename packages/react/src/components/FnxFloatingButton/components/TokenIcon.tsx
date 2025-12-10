import { useState, useEffect } from 'react';
import { cn } from '../../../utils/cn.js';
import defaultTokenIcon from '../assets/default-token.webp';

type TokenIconSize = 'sm' | 'md' | 'lg' | 'xl';

interface TokenIconProps {
  /** Token logo URI */
  logoURI?: string | null;
  /** Alt text for the image */
  alt?: string;
  /** Size variant */
  size?: TokenIconSize;
  /** CSS class name for the container div (overrides size if provided) */
  className?: string;
  /** CSS class name for the image */
  imageClassName?: string;
}

const sizeClasses: Record<TokenIconSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export const TokenIcon: React.FC<TokenIconProps> = ({
  logoURI,
  alt = 'Token',
  size = 'sm',
  className,
  imageClassName = 'w-full h-full object-cover',
}) => {
  const [iconError, setIconError] = useState(false);

  // Reset error when logoURI changes
  useEffect(() => {
    setIconError(false);
  }, [logoURI]);

  const containerClassName =
    className ||
    cn(sizeClasses[size], 'rounded-full fnx-icon-bg flex items-center justify-center flex-shrink-0 overflow-hidden');

  return (
    <div className={containerClassName}>
      <img
        src={iconError || !logoURI ? defaultTokenIcon : logoURI}
        alt={alt}
        className={imageClassName}
        onError={() => setIconError(true)}
      />
    </div>
  );
};
