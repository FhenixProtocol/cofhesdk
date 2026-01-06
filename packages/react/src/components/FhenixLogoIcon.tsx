import { cn } from '@/utils';
import fhenixIconBlack from '@/assets/fhenix-icon-black.png';
import fhenixIconWhite from '@/assets/fhenix-icon-white.png';

export const FhenixLogoIcon: React.FC<{ theme: 'dark' | 'light'; className?: string }> = ({ theme, className }) => {
  return (
    <img
      className={cn('w-10 h-10', className)}
      src={theme === 'dark' ? fhenixIconWhite : fhenixIconBlack}
      alt="Fhenix Logo Icon"
    />
  );
};
