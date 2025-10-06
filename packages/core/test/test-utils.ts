import { expect } from 'vitest';
import { Result, CofhesdkError, CofhesdkErrorCode } from '../src';

/**
 * Assert that a Result is successful and return its data
 * Useful for type narrowing in tests
 */
export const expectResultSuccess = <T>(result: Result<T>): NonNullable<T> => {
  expect(result.error, `Result error: ${result.error?.toString()}`).toBe(null);
  expect(result.success, `Result: ${result}`).toBe(true);
  expect(result.data, `Result: ${result}`).not.toBe(null);
  return result.data!;
};

/**
 * Assert that a Result is an error and optionally verify the error details
 */
export const expectResultError = <T>(
  result: Result<T>,
  errorCode?: CofhesdkErrorCode,
  errorMessage?: string
): CofhesdkError => {
  expect(result.success, `Result: ${result}`).toBe(false);
  expect(result.data, `Result: ${result}`).toBe(null);
  expect(result.error, `Result: ${result}`).not.toBe(null);
  const error = result.error as CofhesdkError;
  expect(error, `Result error: ${result.error?.toString()}`).toBeInstanceOf(CofhesdkError);
  if (errorCode) {
    expect(error.code, `Result error: ${result.error?.toString()}`).toBe(errorCode);
  }
  if (errorMessage) {
    expect(error.message, `Result error: ${result.error?.toString()}`).toBe(errorMessage);
  }
  return error;
};
