import { cn } from '../../../../utils/cn.js';
import { GoArrowUpRight } from "react-icons/go";
import { IoIosSwap } from "react-icons/io";
import { AiOutlinePieChart } from "react-icons/ai";
import { TbShieldPlus } from "react-icons/tb";
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext.js';

type NavItem = 'send' | 'shield' | 'portfolio' | 'activity';

export const BottomNavigation: React.FC = () => {
  const { navigateToSend, navigateToShield, navigateToPortfolio, navigateToActivity, expandPanel } = useFnxFloatingButtonContext();
  const iconClassName = "w-4 h-4";
  
  const handleNavClick = (id: NavItem) => {
    expandPanel(); // Ensure panel is expanded
    switch (id) {
      case 'send':
        navigateToSend();
        break;
      case 'shield':
        navigateToShield();
        break;
      case 'portfolio':
        navigateToPortfolio();
        break;
      case 'activity':
        navigateToActivity();
        break;
    }
  };

  const navItems: Array<{ id: NavItem; label: string; icon: React.ReactNode }> = [
    {
      id: 'send',
      label: 'Send',
      icon: <GoArrowUpRight className={iconClassName} />,
    },
    {
      id: 'shield',
      label: 'Shield',
      icon: <TbShieldPlus className={iconClassName} />,
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      icon: <AiOutlinePieChart className={iconClassName} />,
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <IoIosSwap className={iconClassName} />,
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

