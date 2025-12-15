import { useCallback, useMemo } from 'react';
import { zeroAddress } from 'viem';
import { PermitUtils } from '@cofhe/sdk/permits';
import { useCofheActivePermit, useCofheAllPermits, useCofheSelectPermit } from '../useCofhePermits.js';
import { useFnxFloatingButtonContext } from '@/components/FnxFloatingButton/FnxFloatingButtonContext.js';
import { useCopyFeedback } from '../useCopyFeedback.js';
import { formatExpirationLabel, truncateAddress } from '@/utils/utils.js';

const COPY_KEY = 'permit-details-json';

export const usePermitDetailsPage = (selectedPermitHash: string) => {
  const allPermits = useCofheAllPermits();
  const activePermit = useCofheActivePermit();
  const selectActivePermit = useCofheSelectPermit();
  const { navigateBack } = useFnxFloatingButtonContext();
  const { isCopied, copyWithFeedback } = useCopyFeedback();

  const selectedPermit = useMemo(() => {
    return allPermits.find((entry) => entry.hash === selectedPermitHash);
  }, [allPermits, selectedPermitHash]);

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

  const isShareablePermit = selectedPermit?.permit?.type === 'sharing';

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
    isShareablePermit,
  };
};
