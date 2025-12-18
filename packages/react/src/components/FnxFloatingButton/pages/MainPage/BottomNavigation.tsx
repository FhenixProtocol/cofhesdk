import { cn } from '@/utils/cn';
import { GoArrowUpRight } from 'react-icons/go';
import { IoMdKey } from 'react-icons/io';
import { AiOutlinePieChart } from 'react-icons/ai';
import { TbShieldPlus } from 'react-icons/tb';
import { FaBug } from 'react-icons/fa';
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext';
import { FloatingButtonPage } from '../../pagesConfig/types';

type NavItem = {
  id: FloatingButtonPage;
  label: string;
  icon: React.ReactNode;
};

export const BottomNavigation: React.FC = () => {
  const { navigateTo, navigateToTokenListForView, expandPanel } = useFnxFloatingButtonContext();
  const iconClassName = 'w-4 h-4';

  const handleNavClick = (page: FloatingButtonPage) => {
    expandPanel(); // Ensure panel is expanded
    if (page === FloatingButtonPage.TokenList) {
      navigateToTokenListForView();
      return;
    }
    navigateTo(page as any);
  };

  const navItems: NavItem[] = [
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
  ];

  return (
    <div className="flex gap-2 mt-4">
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
