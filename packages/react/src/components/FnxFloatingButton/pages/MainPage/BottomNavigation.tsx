import { cn } from '../../../../utils/cn.js';
import { GoArrowUpRight } from "react-icons/go";
import { IoIosSwap } from "react-icons/io";
import { AiOutlinePieChart } from "react-icons/ai";
import { TbShieldPlus } from "react-icons/tb";
import { useFnxFloatingButtonContext, FloatingButtonPage } from '../../FnxFloatingButtonContext.js';

type NavItem = {
  id: FloatingButtonPage;
  label: string;
  icon: React.ReactNode;
};

export const BottomNavigation: React.FC = () => {
  const { navigateTo, expandPanel } = useFnxFloatingButtonContext();
  const iconClassName = "w-4 h-4";
  
  const handleNavClick = (page: FloatingButtonPage) => {
    expandPanel(); // Ensure panel is expanded
    navigateTo(page);
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
      id: FloatingButtonPage.Activity,
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

