import { cn } from '@/utils';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Button } from './components';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa6';

interface AccordionContextValue {
  activeId: string | null;
  toggle: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | undefined>(undefined);

interface AccordionProps {
  children: ReactNode;
  defaultActiveId?: string | null;
}

export const Accordion = ({ children, defaultActiveId = null }: AccordionProps) => {
  const [activeId, setActiveId] = useState<string | null>(defaultActiveId);

  const handleToggle = useCallback(
    (id: string) => {
      setActiveId(activeId === id ? null : id);
    },
    [activeId]
  );

  const contextValue = useMemo<AccordionContextValue>(
    () => ({
      activeId,
      toggle: handleToggle,
    }),
    [handleToggle, activeId]
  );

  return <AccordionContext.Provider value={contextValue}>{children}</AccordionContext.Provider>;
};

const useAccordionContext = () => {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion');
  }

  return context;
};

interface AccordionSectionProps {
  id: string;
  renderHeader: (isOpen: boolean) => ReactNode;
  children: ReactNode;
  sectionClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export const AccordionSection = ({
  id,
  renderHeader,
  children,
  sectionClassName,
  triggerClassName,
  contentClassName,
}: AccordionSectionProps) => {
  const { activeId, toggle } = useAccordionContext();
  const isOpen = activeId === id;

  return (
    <section className={sectionClassName}>
      <Button
        variant="ghost"
        className={cn('!justify-start w-full text-md py-2', triggerClassName)}
        aria-expanded={isOpen}
        onClick={() => toggle(id)}
      >
        {renderHeader(isOpen)}
        <span className="flex flex-1" />
        {isOpen ? <FaChevronUp /> : <FaChevronDown />}
      </Button>
      {isOpen ? (
        <div className={cn('relative', contentClassName)}>
          <span
            className="absolute left-0 top-0 bottom-0 border-l border-[#0E2F3F]/30 dark:border-white/40"
            aria-hidden
          />
          {children}
        </div>
      ) : null}
    </section>
  );
};
