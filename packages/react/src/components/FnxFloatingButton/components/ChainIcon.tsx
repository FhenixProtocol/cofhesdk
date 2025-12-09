import { cn } from '../../../utils/cn.js';

// The icons probably needs to be part of the SDK chains package
// Import chain icons
import sepolia from '../assets/chains/11155111.svg';
import baseSepolia from '../assets/chains/84532.svg';

const chainIcons: Record<number, React.FC<React.SVGProps<SVGSVGElement>>> = {
  11155111: sepolia,
  84532: baseSepolia,
};

interface ChainIconProps {
  chainId: number | undefined;
  className?: string;
}

export const ChainIcon: React.FC<ChainIconProps> = ({ chainId, className }) => {
  const Icon = chainId ? chainIcons[chainId] : undefined;

  if (Icon) {
    return <Icon className={cn('w-4 h-4 flex-shrink-0', className)} />;
  }

  // Fallback icon
  return (
    <div className={cn('w-4 h-4 rounded-full fnx-icon-bg flex items-center justify-center flex-shrink-0', className)}>
      <span className="text-[8px]">⟠</span>
    </div>
  );
};
