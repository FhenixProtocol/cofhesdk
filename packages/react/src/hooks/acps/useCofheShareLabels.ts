import { useMemo } from 'react';
import {
  describeShareMetadata,
  type LabelledShare,
  type ShareLabelAbis,
  type ShareLabelCheck,
  type ShareLabelDescription,
  type ShareLabelVerifyMode,
} from '@cofhe/sdk/acps';
import { useInternalQuery } from '../../providers/index.js';
import { useCofheClient } from '../useCofheClient.js';
import { useCofheChainId } from '../useCofheConnection.js';

const SHARE_LABEL_CHECKS_KEY = 'cofhe-share-label-checks';

/** A label as described from the blob, with its check: `pending` until the chain answers. */
export type CofheShareLabel = ShareLabelDescription & { check: ShareLabelCheck | 'pending' };

export type UseCofheShareLabelsResult = {
  /** One item per handle, in order; null for a share without labels. */
  labels: CofheShareLabel[] | null;
  /** The blob could not be decoded: the labels are unusable, the share itself is not affected. */
  error: Error | null;
  /** Checks are still running. */
  isVerifying: boolean;
};

/**
 * The labels of a share — where each of its handles came from — described from the share's
 * metadata blob at once, then checked against the chain as far as `verify` says (default `all`:
 * labels are the issuer's claim). The share is one read from the registry or an acp imported from
 * exported JSON; both carry the same blob. `abis` names the functions and events of the contracts
 * the labels point at; contracts without one stay in raw form.
 */
export const useCofheShareLabels = (
  share: LabelledShare | null | undefined,
  { verify = 'all', abis }: { verify?: ShareLabelVerifyMode; abis?: ShareLabelAbis } = {}
): UseCofheShareLabelsResult => {
  const cofheClient = useCofheClient();
  const chainId = useCofheChainId();
  const issuer = share?.issuer;
  const handles = share?.handles;
  const metadata = share?.metadata;

  const described = useMemo((): { items: ShareLabelDescription[] | null; error: Error | null } => {
    if (issuer == null || handles == null || metadata == null || metadata === '0x') return { items: null, error: null };
    try {
      return { items: describeShareMetadata(metadata, handles, abis, { issuer }), error: null };
    } catch (e) {
      return { items: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [issuer, handles, metadata, abis]);

  // A label points at a past block, so its check never changes: fetched once per share and mode.
  // Keyed by what the checks read, so a share and the acp imported from it share one result.
  const checks = useInternalQuery<ShareLabelCheck[] | null>({
    queryKey: [SHARE_LABEL_CHECKS_KEY, chainId, issuer, handles, metadata, verify],
    enabled: described.items != null && chainId != null,
    staleTime: Infinity,
    queryFn: () => cofheClient.acp.verifyShareLabels(share!, { verify }),
  });

  const labels = useMemo(
    () =>
      described.items?.map(
        (item, i): CofheShareLabel => ({
          ...item,
          check: checks.data?.[i] ?? (checks.isError ? 'unverifiable' : 'pending'),
        })
      ) ?? null,
    [described.items, checks.data, checks.isError]
  );

  return { labels, error: described.error, isVerifying: checks.isFetching };
};
