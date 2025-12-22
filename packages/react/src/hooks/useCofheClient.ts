import type { CofhesdkClient } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import type { CofhesdkConfigWithReact } from '@/config';

export const useCofheClient = (): CofhesdkClient<CofhesdkConfigWithReact> => {
  return useCofheContext().client;
};
