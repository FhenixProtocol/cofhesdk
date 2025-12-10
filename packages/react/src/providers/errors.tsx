import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
export function shouldPassToErrorBoundary(_error: unknown): boolean {
  // TODO: f.x. permit -> need to be passed here in order to redirect
  if (_error instanceof CofhesdkError) {
    if (_error.code === CofhesdkErrorCode.PermitNotFound) return true;
  }
  return false;
}
