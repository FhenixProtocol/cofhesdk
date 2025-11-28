import type { CofhesdkClient } from '@cofhe/sdk';
import { useCofheContext } from '../providers';

export const useCofheClient = (): CofhesdkClient => {
  return useCofheContext().client;
};
