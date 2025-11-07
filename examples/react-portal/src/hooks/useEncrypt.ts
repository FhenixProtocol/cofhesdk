import { useEncryptInput } from '@cofhe/react';
import { useQuery } from '@tanstack/react-query';

type Options = {
  enabled?: boolean;
};
export function useEncrypt(value: string, options: Options = {}) {
  const fn = useEncryptInput();
  const result = useQuery({
    queryKey: ['encrypt', value],
    queryFn: async () => {
      console.log('Encrypting value:', value);
      // Simulate an encryption operation
      return fn.onEncryptInput('uint128', value);
    },
    retry: false, // prevent default 3 exponentialy timed retries
    ...options,
  });

  return result;
}
