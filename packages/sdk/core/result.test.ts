import { describe, it, expect } from 'vitest';
import { ResultOk, ResultErr, ResultErrOrInternal, resultWrapper, resultWrapperSync, type Result } from './result.js';
import { CofhesdkError, CofhesdkErrorCode } from './error.js';

export const expectResultError = <T>(result: Result<T>, errorPartial: string) => {
  expect(result.success).to.eq(false, 'Result should be an error');
  expect(result.error!.message).to.include(errorPartial, `Error should contain error partial: ${errorPartial}`);
};

export const expectResultSuccess = <T>(result: Result<T>): T => {
  expect(result.success).to.eq(true, 'Result should be a success');
  return result.data!;
};

export const expectResultValue = <T>(result: Result<T>, value: T): T => {
  expect(result.success).to.eq(true, 'Result should be a success');
  expect(result.data).to.eq(value, `Result should have the expected value ${value}`);
  return result.data!;
};

describe('Result Type', () => {
  describe('ResultOk', () => {
    it('should create a successful result', () => {
      const result = ResultOk('test data');
      expect(result.success).toBe(true);
      expect(result.data).toBe('test data');
      expect(result.error).toBe(null);
    });

    it('should handle different data types', () => {
      const stringResult = ResultOk('string');
      const numberResult = ResultOk(42);
      const objectResult = ResultOk({ key: 'value' });
      const nullResult = ResultOk(null);

      expect(stringResult.data).toBe('string');
      expect(numberResult.data).toBe(42);
      expect(objectResult.data).toEqual({ key: 'value' });
      expect(nullResult.data).toBe(null);
    });
  });

  describe('ResultErr', () => {
    it('should create an error result', () => {
      const error = new CofhesdkError({
        code: CofhesdkErrorCode.InternalError,
        message: 'Test error',
      });
      const result = ResultErr(error);

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
      expect(result.error).toBe(error);
    });
  });
});

describe('Error Utilities', () => {
  describe('ResultErrOrInternal', () => {
    it('should wrap unknown errors as internal errors', () => {
      const result = ResultErrOrInternal(new Error('string error'));
      expect(result.success).toBe(false);
      expect(result.error!).toBeInstanceOf(CofhesdkError);
      expect(result.error!.code).toBe(CofhesdkErrorCode.InternalError);
      expect(result.error!.message).toBe('An internal error occurred | Caused by: string error');
    });

    it('should preserve CofhesdkError instances', () => {
      const originalError = new CofhesdkError({
        code: CofhesdkErrorCode.MissingPublicClient,
        message: 'Public client missing',
      });
      const result = ResultErrOrInternal(originalError);
      expect(result.success).toBe(false);
      expect(result.error!).toBe(originalError);
    });

    it('should handle Error instances', () => {
      const error = new Error('Standard error');
      const result = ResultErrOrInternal(error);
      expect(result.success).toBe(false);
      expect(result.error!).toBeInstanceOf(CofhesdkError);
      expect(result.error!.cause).toBe(error);
    });
  });
});

describe('Result Wrappers', () => {
  describe('resultWrapperSync', () => {
    it('should wrap successful sync function', () => {
      const result = resultWrapperSync(() => 'success');
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });

    it('should wrap failing sync function', () => {
      const result = resultWrapperSync(() => {
        throw new Error('Sync error');
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CofhesdkError);
    });
  });

  describe('resultWrapper', () => {
    it('should wrap successful async function', async () => {
      const result = await resultWrapper(async () => 'async success');
      expect(result.success).toBe(true);
      expect(result.data).toBe('async success');
    });

    it('should wrap failing async function', async () => {
      const result = await resultWrapper(async () => {
        throw new Error('Async error');
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CofhesdkError);
    });

    it('should handle async operations', async () => {
      const result = await resultWrapper(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'delayed result';
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe('delayed result');
    });

    it('should handle Promise rejections', async () => {
      const result = await resultWrapper(async () => {
        return Promise.reject(new Error('Promise rejection'));
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CofhesdkError);
    });
  });
});

describe('Result Type Guards', () => {
  it('should correctly identify success results', () => {
    const successResult = ResultOk('data');
    expect(successResult.success).toBe(true);
    expect(successResult.data).toBe('data');
    expect(successResult.error).toBe(null);
  });

  it('should correctly identify error results', () => {
    const errorResult = ResultErr(
      new CofhesdkError({
        code: CofhesdkErrorCode.InternalError,
        message: 'Test error',
      })
    );
    expect(errorResult.success).toBe(false);
    expect(errorResult.data).toBe(null);
    expect(errorResult.error).toBeInstanceOf(CofhesdkError);
  });
});

describe('Result Test Utilities', () => {
  it('expectResultSuccess should return data for success', () => {
    const result = ResultOk('data');
    expect(expectResultSuccess(result)).toBe('data');
  });

  it('expectResultValue should validate and return matching data', () => {
    const result = ResultOk('expected');
    expect(expectResultValue(result, 'expected')).toBe('expected');
  });

  it('expectResultError should validate error messages', () => {
    const result = ResultErr(
      new CofhesdkError({
        code: CofhesdkErrorCode.InternalError,
        message: 'Test error message',
      })
    );
    expectResultError(result, 'Test error');
  });
});
