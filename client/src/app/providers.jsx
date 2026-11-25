import { useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/modules/auth/hooks/useAuth.jsx';
import { createQueryClient } from '@/shared/lib/queryClient.js';

export function AppProviders({ children }) {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
