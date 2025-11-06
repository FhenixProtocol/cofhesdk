import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client
const queryClient = new QueryClient();

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    // Provide the client to your App
    // @ts-expect-error something wrong with children type
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
