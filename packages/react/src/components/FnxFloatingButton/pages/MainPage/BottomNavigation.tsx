import { cn } from '@/utils/cn';
import { GoArrowUpRight } from 'react-icons/go';
import { IoMdKey } from 'react-icons/io';
import { AiOutlinePieChart } from 'react-icons/ai';
import { TbShieldPlus } from 'react-icons/tb';
import { FaBug } from 'react-icons/fa';
import type { ComponentType, ReactNode } from 'react';
import { FloatingButtonPage } from '../../pagesConfig/types';
import { useCofhePinnedToken } from '@/hooks/useCofhePinnedToken';
import { assert, type ElementOf } from 'ts-essentials';
import { usePortalNavigation, usePortalUI } from '@/stores';
import { Button } from '../../components';
import { useCofheClaimableTokens } from '@/hooks/useCofheClaimableTokens';

const iconClassName = 'w-4 h-4';

const ShieldIcon = () => {
  const { totalTokensClaimable } = useCofheClaimableTokens();

  const badgeText = totalTokensClaimable > 99 ? '99+' : totalTokensClaimable > 0 ? `+${totalTokensClaimable}` : null;

  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6 shrink-0">
      <TbShieldPlus className={iconClassName} />
      {badgeText && (
        <span
          className={cn(
            'pointer-events-none',
            'absolute top-0 right-0',
            'translate-x-[35%] -translate-y-[35%]',
            'min-w-[18px] h-[18px] px-1',
            'rounded-full',
            'flex items-center justify-center',
            'text-[10px] leading-none font-semibold',
            'bg-[#6EE7F5] text-[#003B4A]',
            'outline outline-2 outline-[var(--fnx-button-bg)]',
            'shadow-sm'
          )}
        >
          {badgeText}
        </span>
      )}
    </span>
  );
};

type PagesInBottomMenu =
  | FloatingButtonPage.Send
  | FloatingButtonPage.Shield
  | FloatingButtonPage.TokenList
  | FloatingButtonPage.Permits
  | FloatingButtonPage.Debug;

const baseNavItems: {
  id: PagesInBottomMenu;
  label: string;
  icon: ReactNode | ComponentType<{}>;
}[] = [
  {
    id: FloatingButtonPage.Send,
    label: 'Send',
    icon: <GoArrowUpRight className={iconClassName} />,
  },
  {
    id: FloatingButtonPage.Shield,
    label: 'Shield',
    icon: ShieldIcon,
  },
  {
    id: FloatingButtonPage.Portfolio,
    label: 'Portfolio',
    icon: <AiOutlinePieChart className={iconClassName} />,
  },
  {
    id: FloatingButtonPage.Permits,
    label: 'Permits',
    icon: <IoMdKey className={iconClassName} />,
  },
] as const;

const debugNavItem = {
  id: FloatingButtonPage.Debug,
  label: 'Debug',
  icon: <FaBug className={iconClassName} />,
} as const;

/**
 * Checks if we're in production by checking multiple environment variable sources
 * Supports: process.env (Node.js/webpack), import.meta.env (Vite), and other common patterns
 */
const isProduction = (): boolean => {
  // Check process.env (Node.js, webpack, etc.)
  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-undef
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return false;
  }

  // Check import.meta.env (Vite)
  if (typeof import.meta !== 'undefined') {
    //     {
    //     "BASE_URL": "/",
    //     "DEV": true,
    //     "MODE": "development",
    //     "PROD": false,
    //     "SSR": false
    // }
    const metaEnv = (import.meta as any).env;

    // ONLY if ALL flags indicate development AND prod flag doesn't indicate prod, treat as development
    if (metaEnv && metaEnv.MODE === 'development' && metaEnv.DEV === true && metaEnv.PROD === false) {
      return false;
    }
  }

  // Default to hiding debug in library context
  return true;
};

const navItems = [...baseNavItems, ...(!isProduction() ? [debugNavItem] : [])] as const;

export const BottomNavigation: React.FC = () => {
  const { navigateTo } = usePortalNavigation();
  const { openPortal } = usePortalUI();
  const defaultToken = useCofhePinnedToken();

  const handleNavClick = (page: ElementOf<typeof baseNavItems>['id']) => {
    openPortal();

    if (page === FloatingButtonPage.Portfolio) {
      navigateTo(FloatingButtonPage.Portfolio);
      return;
    }

    if (page === FloatingButtonPage.Send) {
      assert(defaultToken, 'No pinned token available for Send page');
      navigateTo(FloatingButtonPage.Send, { pageProps: { token: defaultToken } });
      return;
    }

    if (page === FloatingButtonPage.Shield) {
      assert(defaultToken, 'No pinned token available for Shield page');
      navigateTo(FloatingButtonPage.Shield, { pageProps: { token: defaultToken } });
      return;
    }

    navigateTo(page);
  };

  return (
    <div className="flex gap-2">
      {navItems.map((item) => (
        <Button
          key={item.id}
          onClick={() => handleNavClick(item.id)}
          icon={typeof item.icon === 'function' ? <item.icon /> : item.icon}
          iconPosition="top"
          label={item.label}
          className="flex-1"
        />
      ))}
    </div>
  );
};
