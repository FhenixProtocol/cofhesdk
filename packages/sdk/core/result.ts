import { CofhesdkError, CofhesdkErrorCode } from './error.js';

export type Result<T> = { success: true; data: T; error: null } | { success: false; data: null; error: CofhesdkError };

export const ResultErr = <T>(error: CofhesdkError): Result<T> => ({
  success: false,
  data: null,
  error,
});

export const ResultOk = <T>(data: T): Result<T> => ({
  success: true,
  data,
  error: null,
});

export const ResultErrOrInternal = <T>(error: unknown): Result<T> => {
  return ResultErr(CofhesdkError.fromError(error));
};

export const ResultHttpError = (error: unknown, url: string, status?: number): CofhesdkError => {
  if (error instanceof CofhesdkError) return error;

  const message = status ? `HTTP error ${status} from ${url}` : `HTTP request failed for ${url}`;

  return new CofhesdkError({
    code: CofhesdkErrorCode.InternalError,
    message,
    cause: error instanceof Error ? error : undefined,
  });
};

export const ResultValidationError = (message: string): CofhesdkError => {
  return new CofhesdkError({
    code: CofhesdkErrorCode.InvalidPermitData,
    message,
  });
};

// Async resultWrapper
export const resultWrapper = async <T>(
  tryFn: () => Promise<T>,
  catchFn?: (error: CofhesdkError) => void,
  finallyFn?: () => void
): Promise<Result<T>> => {
  try {
    const result = await tryFn();
    return ResultOk(result);
  } catch (error) {
    const result = ResultErrOrInternal(error);
    catchFn?.(result.error!);
    return result as Result<T>;
  } finally {
    finallyFn?.();
  }
};

// Sync resultWrapper
export const resultWrapperSync = <T>(fn: () => T): Result<T> => {
  try {
    const result = fn();
    return ResultOk(result);
  } catch (error) {
    return ResultErrOrInternal(error);
  }
};
