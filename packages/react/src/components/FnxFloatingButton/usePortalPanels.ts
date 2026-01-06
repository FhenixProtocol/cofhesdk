import { useState } from 'react';
import { useTimeout } from '../../hooks/useTimeout';
import type { FnxStatus } from './types';

const ANIM_DURATION = 300;

export function usePortalPanels(status?: FnxStatus) {
  const [portalOpen, setPortalOpen] = useState(false);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [contentPanelOpen, setContentPanelOpen] = useState(false);

  // opening flow: 1. display status panel 2. after delay display content panel
  const { run: openPortal, clear: cancelOpeningTimeout } = useTwoStepAction({
    stepOne: () => {
      setPortalOpen(true);
      // cancel closing timeout to avoid race condition for statusPanelOpen state
      cancelClosingTimeout();
      // Open status panel immediately safe from race condition
      setStatusPanelOpen(true);
    },
    delayMs: statusPanelOpen || status != null ? 0 : ANIM_DURATION,
    stepTwo: () => {
      setContentPanelOpen(true);
    },
  });

  // closing flow is backwards: 1. hide content panel 2. after delay hide status panel
  const { run: closePortal, clear: cancelClosingTimeout } = useTwoStepAction({
    stepOne: () => {
      setPortalOpen(false);
      // cancel opening timeout to avoid race condition for contentPanelOpen state
      cancelOpeningTimeout();
      // Close content panel immediately
      setContentPanelOpen(false);
    },
    delayMs: ANIM_DURATION,
    stepTwo: () => {
      setStatusPanelOpen(false);
    },
  });

  const togglePortal = () => {
    portalOpen ? closePortal() : openPortal();
  };

  return {
    portalOpen,
    statusPanelOpen,
    contentPanelOpen,
    openPortal,
    closePortal,
    togglePortal,
  };
}

type TwoStepsActionInput = {
  stepOne: () => void;
  delayMs: number;
  stepTwo: () => void;
};

function useTwoStepAction({ stepOne, stepTwo, delayMs }: TwoStepsActionInput) {
  const { set, clear } = useTimeout();
  const run = () => {
    stepOne();
    if (delayMs === 0) {
      // if no delay, run step two immediately
      stepTwo();
    } else {
      // else run step two after delay
      set(() => {
        stepTwo();
      }, delayMs);
    }
  };
  return { run, clear };
}
