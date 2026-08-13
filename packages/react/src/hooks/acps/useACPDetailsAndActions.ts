import { useCallback, useMemo } from 'react';
import { zeroAddress } from 'viem';
import { ACPUtils } from '@cofhe/sdk/acps';
import { useCofheActiveACP, useCofheACP, useCofheRemoveACP, useCofheSelectACP } from '../useCofheACPs.js';
import { useCopyFeedback } from '../useCopyFeedback.js';
import { formatExpirationLabel, truncateAddress } from '@/utils/utils.js';
import { usePortalNavigation, usePortalToasts } from '@/stores';

const COPY_KEY = 'acp-details-json';

export const useACPDetailsAndActions = (acpHash: string) => {
  const acp = useCofheACP(acpHash);
  const activeACP = useCofheActiveACP();
  const { navigateBack } = usePortalNavigation();
  const { isCopied, copyWithFeedback } = useCopyFeedback();
  const { addToast } = usePortalToasts();
  const selectActiveACP = useCofheSelectACP({
    onSuccess: () => {
      addToast({
        variant: 'success',
        title: 'ACP selected',
      });
    },
    onError: (error) => {
      addToast({
        variant: 'error',
        title: 'Failed to select acp',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
  const removeACP = useCofheRemoveACP({
    onSuccess: () => {
      addToast({
        variant: 'success',
        title: 'ACP deleted',
      });
    },
    onError: (error) => {
      addToast({
        variant: 'error',
        title: 'Failed to delete acp',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const isActiveACP = acp != null && activeACP?.acp.hash === acpHash;
  const expirationDate = acp != null ? new Date(acp.expiration * 1000).toLocaleString() : undefined;
  const isShareableACP = acp?.type === 'sharing';

  const acpLabel = useMemo(() => {
    if (!acp) return undefined;
    if (acp.name?.trim()) return acp.name;
    const fallbackAddress = acp.recipient && acp.recipient !== zeroAddress ? acp.recipient : acp.issuer || zeroAddress;
    return truncateAddress(fallbackAddress, 4, 4) ?? fallbackAddress;
  }, [acp]);

  const expirationInfo = useMemo(() => formatExpirationLabel(acp?.expiration), [acp?.expiration]);

  const acpJson = useMemo(() => {
    // only sharing ACPs are exportable — export() includes the issuer signature
    if (!acp || acp.type !== 'sharing') return undefined;
    return ACPUtils.export(acp);
  }, [acp]);

  const handleBack = useCallback(() => {
    navigateBack();
  }, [navigateBack]);

  const handleCopySharableACPData = useCallback(() => {
    if (!acpJson) return;
    copyWithFeedback(COPY_KEY, acpJson);
    addToast({
      variant: 'success',
      title: 'ACP data copied',
      description: 'Share copied data with recipient.',
    });
  }, [copyWithFeedback, acpJson, addToast]);

  const handleSelectActiveACP = useCallback(() => {
    selectActiveACP(acpHash);
  }, [selectActiveACP, acpHash]);

  const handleRemoveACP = useCallback(() => {
    removeACP(acpHash);
  }, [removeACP, acpHash]);

  return {
    acpExists: acp != null,
    acp,
    acpLabel,
    acpJson,
    expirationInfo,
    expirationDate,
    handleBack,
    handleCopySharableACPData,
    handleSelectActiveACP,
    handleRemoveACP,
    isCopyComplete: isCopied(COPY_KEY),
    isActiveACP,
    isShareableACP,
  };
};
