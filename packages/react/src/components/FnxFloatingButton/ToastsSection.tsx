import { cn } from '../../utils/cn';
import { useState, useEffect, useRef, useMemo } from 'react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { pages } from './pagesConfig/const';
import type { PageState } from './pagesConfig/types';
import type { FnxFloatingButtonToast } from './types';

const CONTENT_TRANSITION_DURATION = 150; // Duration in milliseconds for content fade transition

interface ToastsSectionProps {
  className?: string;
}

const ToastComponent: React.FC<FnxFloatingButtonToast> = ({ id, duration, content }) => {
  const { removeToast } = useFnxFloatingButtonContext();

  useEffect(() => {
    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [duration, id]);

  return (
    <div key={id} className={cn('min-h-8 bg-white border')}>
      {content}
    </div>
  );
};

export const ToastsSection: React.FC<ToastsSectionProps> = ({ className }) => {
  const { toasts } = useFnxFloatingButtonContext();
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} {...toast} />
      ))}
    </div>
  );
};
