import { type Result } from "cofhesdk/core";
import { expect } from "chai";

export const expectResultError = <T>(
  result: Result<T>,
  errorPartial: string,
) => {
  expect(result.success).to.eq(false, "Result should be an error");
  expect(result.error).to.include(
    errorPartial,
    `Error should contain error partial: ${errorPartial}`,
  );
};

export const expectResultSuccess = <T>(result: Result<T>): T => {
  expect(result.success).to.eq(true, "Result should be a success");
  return result.data!;
};

export const expectResultValue = <T>(result: Result<T>, value: T): T => {
  expect(result.success).to.eq(true, "Result should be a success");
  expect(result.data).to.eq(
    value,
    `Result should have the expected value ${value}`,
  );
  return result.data!;
};

export const expectResultPartialValue = <T>(
  result: Result<T>,
  partial: Partial<T>,
): T => {
  expect(result.success).to.eq(true, "Result should be a success");
  expect(result.data).to.include(
    partial,
    `Result should have the expected partial ${partial}`,
  );
  return result.data!;
};
