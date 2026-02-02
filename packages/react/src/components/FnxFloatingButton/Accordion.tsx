import { cn } from '@/utils';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface AccordionContextValue {
  activeId: string | null;
  toggle: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | undefined>(undefined);

interface AccordionProps {
  children: ReactNode;
  defaultActiveId?: string | null;
  activeId?: string | null;
  onChange?: (id: string) => void;
}

export const Accordion = ({ children, defaultActiveId = null, activeId, onChange }: AccordionProps) => {
  const [internalActiveId, setInternalActiveId] = useState<string | null>(defaultActiveId);
  const resolvedActiveId = activeId ?? internalActiveId;

  const handleToggle = useCallback(
    (id: string) => {
      if (resolvedActiveId === id) {
        return;
      }

      if (activeId === undefined) {
        setInternalActiveId(id);
      }

      onChange?.(id);
    },
    [activeId, onChange, resolvedActiveId]
  );

  const contextValue = useMemo<AccordionContextValue>(
    () => ({
      activeId: resolvedActiveId,
      toggle: handleToggle,
    }),
    [handleToggle, resolvedActiveId]
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
      <button type="button" className={triggerClassName} aria-expanded={isOpen} onClick={() => toggle(id)}>
        {renderHeader(isOpen)}
      </button>
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
