import { useEncryptInput } from '@cofhe/react';
import { useQuery } from '@tanstack/react-query';

export function useEncrypt(value: string) {
  const fn = useEncryptInput();
  return useQuery({
    queryKey: ['encrypt', value],
    queryFn: async () => {
      console.log('Encrypting value:', value);
      // Simulate an encryption operation
      return fn.onEncryptInput('uint128', value);
    },
    retry: false, // prevent default 3 exponentialy timed retries
  });
}
