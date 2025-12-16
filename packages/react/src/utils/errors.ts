export enum ErrorCause {
  AttemptToFetchConfidentialBalance = 'attempt_to_fetch_confidential_balance',
}

export function getErrorCause(error: unknown): ErrorCause | null {
  if (typeof error === 'object' && error !== null && '_cause' in error) {
    return (error as any)._cause as ErrorCause;
  }
  return null;
}

/**
 * Ensures that the provided error contains a cause that describes the failed operation.
 * If an error already has a cause, it is preserved by chaining it under the new cause node.
 */
export function attachCauseToError(error: unknown, cause: ErrorCause) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    if ('_cause' in error) {
      console.warn('Error already has a cause, chaining causes, not attching new cause', error, ' new cause:', cause);
    }
    (error as any)._cause = cause;
  } else {
    console.warn('Unfamiliar error type, not attaching cause:', error, ' cause:', cause);
  }
}

/**
 * Wraps a query function so that any thrown error is annotated with a cause message.
 * This keeps the original error instance intact (preserving instanceof checks) while
 * layering a descriptive cause that higher-level handlers can read.
 */
export function withQueryErrorCause<TArgs extends unknown[], TResult>(
  errorCause: ErrorCause,
  queryFn: (...args: TArgs) => Promise<TResult> | TResult
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await queryFn(...args);
    } catch (error) {
      attachCauseToError(error, errorCause);
      throw error;
    }
  };
}
