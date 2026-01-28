import { cn } from '@/utils/cn';
import { GoArrowUpRight } from 'react-icons/go';
import { IoMdKey } from 'react-icons/io';
import { AiOutlinePieChart } from 'react-icons/ai';
import { TbShieldPlus } from 'react-icons/tb';
import { FaBug } from 'react-icons/fa';
import { FloatingButtonPage } from '../../pagesConfig/types';
import { useCofhePinnedToken } from '@/hooks/useCofhePinnedToken';
import { assert, type ElementOf } from 'ts-essentials';
import { usePortalNavigation, usePortalUI } from '@/stores';

const iconClassName = 'w-4 h-4';

const navItems = [
  {
    id: FloatingButtonPage.Send,
    label: 'Send',
    icon: <GoArrowUpRight className={iconClassName} />,
  },
  {
    id: FloatingButtonPage.Shield,
    label: 'Shield',
    icon: <TbShieldPlus className={iconClassName} />,
  },
  {
    id: FloatingButtonPage.TokenList,
    label: 'Portfolio',
    icon: <AiOutlinePieChart className={iconClassName} />,
  },
  {
    id: FloatingButtonPage.Permits,
    label: 'Permits',
    icon: <IoMdKey className={iconClassName} />,
  },
  // TODO: Only enable this locally for debugging
  {
    id: FloatingButtonPage.Debug,
    label: 'Debug',
    icon: <FaBug className={iconClassName} />,
  },
] as const;

export const BottomNavigation: React.FC = () => {
  const { navigateTo } = usePortalNavigation();
  const { openPortal } = usePortalUI();
  const defaultToken = useCofhePinnedToken();

  const handleNavClick = (page: ElementOf<typeof navItems>['id']) => {
    openPortal();

    if (page === FloatingButtonPage.TokenList) {
      navigateTo(FloatingButtonPage.TokenList, {
        pageProps: {
          title: 'Portfolio',
          mode: 'view',
          backToPageState: {
            page: FloatingButtonPage.TokenInfo,
          },
        },
      });
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
        <button
          key={item.id}
          onClick={() => handleNavClick(item.id)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 py-1 px-2',
            'text-sm font-medium',
            'fnx-nav-button fnx-text-primary'
          )}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};
