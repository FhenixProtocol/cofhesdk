import { useCallback, useMemo } from 'react';
import { zeroAddress } from 'viem';
import { PermitUtils } from '@cofhe/sdk/permits';
import {
  useCofheActivePermit,
  useCofhePermit,
  useCofheRemovePermit,
  useCofheSelectPermit,
} from '../useCofhePermits.js';
import { useCopyFeedback } from '../useCopyFeedback.js';
import { formatExpirationLabel, truncateAddress } from '@/utils/utils.js';
import { usePortalNavigation, usePortalToasts } from '@/stores';

const COPY_KEY = 'permit-details-json';

export const usePermitDetailsAndActions = (permitHash: string) => {
  const permit = useCofhePermit(permitHash);
  const activePermit = useCofheActivePermit();
  const { navigateBack } = usePortalNavigation();
  const { isCopied, copyWithFeedback } = useCopyFeedback();
  const { addToast } = usePortalToasts();
  const selectActivePermit = useCofheSelectPermit({
    onSuccess: () => {
      addToast({
        variant: 'success',
        title: 'Permit selected',
      });
    },
    onError: (error) => {
      addToast({
        variant: 'error',
        title: 'Failed to select permit',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
  const removePermit = useCofheRemovePermit({
    onSuccess: () => {
      addToast({
        variant: 'success',
        title: 'Permit deleted',
      });
    },
    onError: (error) => {
      addToast({
        variant: 'error',
        title: 'Failed to delete permit',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const isActivePermit = permit != null && activePermit?.permit.hash === permitHash;
  const expirationDate = permit != null ? new Date(permit.expiration * 1000).toLocaleString() : undefined;
  const isShareablePermit = permit?.type === 'sharing';

  const permitLabel = useMemo(() => {
    if (!permit) return undefined;
    if (permit.name?.trim()) return permit.name;
    const fallbackAddress =
      permit.recipient && permit.recipient !== zeroAddress ? permit.recipient : permit.issuer || zeroAddress;
    return truncateAddress(fallbackAddress, 4, 4) ?? fallbackAddress;
  }, [permit]);

  const expirationInfo = useMemo(() => formatExpirationLabel(permit?.expiration), [permit?.expiration]);

  const permitJson = useMemo(() => {
    if (!permit) return undefined;
    return PermitUtils.export(permit);
  }, [permit]);

  const handleBack = useCallback(() => {
    navigateBack();
  }, [navigateBack]);

  const handleCopySharablePermitData = useCallback(() => {
    if (!permitJson) return;
    copyWithFeedback(COPY_KEY, permitJson);
    addToast({
      variant: 'success',
      title: 'Permit data copied',
      description: 'Share copied data with recipient.',
    });
  }, [copyWithFeedback, permitJson, addToast]);

  const handleSelectActivePermit = useCallback(() => {
    selectActivePermit(permitHash);
  }, [selectActivePermit, permitHash]);

  const handleRemovePermit = useCallback(() => {
    removePermit(permitHash);
  }, [removePermit, permitHash]);

  return {
    permitExists: permit != null,
    permit,
    permitLabel,
    permitJson,
    expirationInfo,
    expirationDate,
    handleBack,
    handleCopySharablePermitData,
    handleSelectActivePermit,
    handleRemovePermit,
    isCopyComplete: isCopied(COPY_KEY),
    isActivePermit,
    isShareablePermit,
  };
};
