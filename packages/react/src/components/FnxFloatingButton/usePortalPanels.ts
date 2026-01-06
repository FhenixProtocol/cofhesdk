import { useRef, useState } from 'react';

const ANIM_DURATION = 300;

export function usePortalPanels() {
  const [portalOpen, setPortalOpen] = useState(false);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [contentPanelOpen, setContentPanelOpen] = useState(false);

  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPortal = () => {
    setPortalOpen(true);

    // Cancel closing timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    // Open status panel immediately
    setStatusPanelOpen(true);

    if (statusPanelOpen || status != null) {
      // Expand content immediately if status panel is visible
      setContentPanelOpen(true);
    } else {
      // Else expand content after a delay
      openTimeoutRef.current = setTimeout(() => {
        setContentPanelOpen(true);
      }, ANIM_DURATION);
    }
  };

  const closePortal = () => {
    setPortalOpen(false);

    // Cancel opening timeout
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }

    // Close content panel immediately
    setContentPanelOpen(false);

    // Close status bar after a delay
    closeTimeoutRef.current = setTimeout(() => {
      setStatusPanelOpen(false);
    }, ANIM_DURATION);
  };

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
