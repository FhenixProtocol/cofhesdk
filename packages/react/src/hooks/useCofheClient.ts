import type { CofheClient } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import type { CofheConfigWithReact } from '@/config';

export const useCofheClient = (): CofheClient<CofheConfigWithReact> => {
  return useCofheContext().client;
};
