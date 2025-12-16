import { useOpenButtonStore } from '../stores/openButtonStore';
import {
  FloatingButtonPage,
  type FloatingButtonPagePropsMap,
  type PagesWithoutProps,
  type PagesWithProps,
  type SendPageProps,
} from '../pagesConfig/types';
import { useCofheTokens } from '../../../hooks/useCofheTokenLists';
import { useCofheChainId } from '../../../hooks/useCofheConnection';

/**
 * Hook to programmatically open the floating button and navigate to a specific page.
 * This hook can be used outside of the FnxFloatingButton component.
 * 
 * @example
 * ```tsx
 * const { openButton } = useCofheOpenButtonWithContext();
 * 
 * // Open button and navigate to token list
 * openButton(FloatingButtonPage.TokenList, {});
 * 
 * // Open button and navigate to send page with pre-selected token
 * openButton(FloatingButtonPage.Send, { 
 *   tokenAddress: '0x...', 
 *   onTokenNotFound: (addr) => console.error('Token not found:', addr) 
 * });
 * ```
 */
export const useCofheOpenButtonWithContext = () => {
  const requestOpen = useOpenButtonStore((state) => state.requestOpen);
  const chainId = useCofheChainId();
  const tokens = useCofheTokens(chainId ?? 0);

  function openButton<K extends PagesWithoutProps>(page: K): void;
  function openButton<K extends PagesWithProps>(page: K, props: FloatingButtonPagePropsMap[K]): void;
  function openButton(page: FloatingButtonPage, props?: FloatingButtonPagePropsMap[FloatingButtonPage]): void {
    // Validate token for Send page before opening
    if (page === FloatingButtonPage.Send && props) {
      const sendProps = props as SendPageProps;
      if (sendProps.tokenAddress) {
        const token = tokens.find(
          (t) => t.address.toLowerCase() === sendProps.tokenAddress!.toLowerCase()
        );
        if (!token) {
          // Token not found - call callback and don't open
          sendProps.onTokenNotFound?.(sendProps.tokenAddress);
          return;
        }
      }
    }

    requestOpen(page, props);
  }

  return { openButton };
};

