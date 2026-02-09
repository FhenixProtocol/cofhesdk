import { cn } from '@/utils/cn';
import { type CSSProperties, useMemo } from 'react';

type StripeProps = {
  /** CSS color for stripes: "#f00", "rgb(...)", "hsl(...)", "currentColor", etc. Use "currentColor" with Tailwind text color classes. */
  stripeColor?: string;
  /** Background/base color behind the stripes */
  baseColor?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export function StripedBackground({
  stripeColor = 'rgba(255,255,255,0.18)',
  baseColor = 'transparent',
  className,
  style,
  children,
}: StripeProps) {
  const bgImage = useMemo(() => {
    // 2px stripe, 2px gap, repeating at 45 degrees (positive diagonal)
    return `repeating-linear-gradient(
      45deg,
      ${stripeColor} 0px,
      ${stripeColor} 2px,
      transparent 2px,
      transparent 4px
    )`;
  }, [stripeColor]);

  const mergedStyle: CSSProperties = {
    backgroundColor: baseColor,
    backgroundImage: bgImage,
    ...style,
  };

  return (
    <div className={className} style={mergedStyle}>
      {children}
    </div>
  );
}

type PermitStripedProps = {
  variant: 'self' | 'sharing' | 'recipient' | 'error' | 'warning';
  className?: string;
  children?: React.ReactNode;
};

const PermitStripedVariantColors: Record<PermitStripedProps['variant'], string> = {
  self: 'text-blue-500',
  sharing: 'text-green-500',
  recipient: 'text-purple-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
};

const PermitStripedVariantOpacities: Record<PermitStripedProps['variant'], string> = {
  self: 'opacity-15',
  sharing: 'opacity-15',
  recipient: 'opacity-15',
  error: 'opacity-30',
  warning: 'opacity-30',
};

export const PermitStripedBackground = ({ variant, className, children }: PermitStripedProps) => {
  const color = PermitStripedVariantColors[variant];
  const opacity = PermitStripedVariantOpacities[variant];
  return (
    <StripedBackground stripeColor="currentColor" className={cn(color, opacity, className)}>
      {children}
    </StripedBackground>
  );
};
