import { useCallback, useMemo } from 'react';
import { zeroAddress } from 'viem';
import { PermitUtils } from '@cofhe/sdk/permits';
import { useCofheActivePermit, useCofheAllPermits, useCofheSelectPermit } from '../useCofhePermits.js';
import { useFnxFloatingButtonContext } from '@/components/FnxFloatingButton/FnxFloatingButtonContext.js';
import { useCopyFeedback } from '../useCopyFeedback.js';
import { truncateAddress } from '@/utils/utils.js';

const COPY_KEY = 'permit-details-json';

const formatExpirationLabel = (expiration?: number) => {
  if (!expiration) {
    return { label: 'Unknown', expired: false };
  }

  const now = Math.floor(Date.now() / 1000);
  const diff = expiration - now;

  if (diff <= 0) {
    return { label: 'Expired', expired: true };
  }

  const day = 60 * 60 * 24;
  const hour = 60 * 60;
  const minute = 60;

  if (diff >= day) {
    const days = Math.ceil(diff / day);
    return { label: `${days} Day${days === 1 ? '' : 's'}`, expired: false };
  }

  if (diff >= hour) {
    const hours = Math.ceil(diff / hour);
    return { label: `${hours} Hour${hours === 1 ? '' : 's'}`, expired: false };
  }

  const minutes = Math.max(1, Math.ceil(diff / minute));
  return { label: `${minutes} Minute${minutes === 1 ? '' : 's'}`, expired: false };
};

export const usePermitDetailsPage = (selectedPermitHash: string) => {
  const allPermits = useCofheAllPermits();
  const activePermit = useCofheActivePermit();
  const selectActivePermit = useCofheSelectPermit();
  const { navigateBack, currentPage } = useFnxFloatingButtonContext();
  const { isCopied, copyWithFeedback } = useCopyFeedback();

  const selectedPermit = useMemo(() => {
    return allPermits.find((entry) => entry.hash === selectedPermitHash);
  }, [allPermits, currentPage]);

  const permitLabel = useMemo(() => {
    const permit = selectedPermit?.permit;
    if (!permit) return undefined;
    if (permit.name?.trim()) return permit.name;
    const fallbackAddress =
      permit.recipient && permit.recipient !== zeroAddress ? permit.recipient : permit.issuer || zeroAddress;
    return truncateAddress(fallbackAddress, 4, 4) ?? fallbackAddress;
  }, [selectedPermit]);

  const expirationInfo = useMemo(
    () => formatExpirationLabel(selectedPermit?.permit.expiration),
    [selectedPermit?.permit.expiration]
  );

  const permitJson = useMemo(() => {
    if (!selectedPermit) return undefined;
    return PermitUtils.export(selectedPermit.permit);
  }, [selectedPermit]);

  const handleBack = useCallback(() => {
    navigateBack();
  }, [navigateBack]);

  const handleCopy = useCallback(() => {
    if (!permitJson) return;
    void copyWithFeedback(COPY_KEY, permitJson);
  }, [copyWithFeedback, permitJson]);

  const handleViewAs = useCallback(() => {
    if (!selectedPermit) return;
    selectActivePermit(selectedPermit.hash);
  }, [selectActivePermit, selectedPermit]);

  const isActivePermit = selectedPermit ? activePermit?.hash === selectedPermit.hash : false;

  const expirationDate = selectedPermit
    ? new Date(selectedPermit.permit.expiration * 1000).toLocaleString()
    : undefined;

  return {
    permitLabel,
    permitJson,
    expirationInfo,
    expirationDate,
    handleBack,
    handleCopy,
    handleViewAs,
    hasSelection: Boolean(selectedPermit),
    isCopyComplete: isCopied(COPY_KEY),
    isActivePermit,
  };
};
