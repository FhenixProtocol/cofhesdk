import { CofhesdkError } from '@cofhe/sdk';
import { useContext } from 'react';
import { ErrorBoundaryContext } from 'react-error-boundary';

/**
 *
 * @returns check if ErrorBoundary is currently handling a CofhesdkError.
 * This is useful to prevent/block interactions with Cofhe until the error is resolved by the handling logic and the error is reset
 */
export function useIsCofheErrorActive(): boolean {
  const errorBoundaryContext = useContext(ErrorBoundaryContext);
  return errorBoundaryContext?.error instanceof CofhesdkError;
}
