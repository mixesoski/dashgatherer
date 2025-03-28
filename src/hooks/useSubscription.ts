
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionStatus {
  active: boolean;
  plan: string | null;
  status: string;
  role: string;
  trialEnd: string | null;
  cancelAt: string | null;
  renewsAt: string | null;
  pendingCheckout?: boolean;
  stripeSubscriptionId?: string;
}

export function useSubscription() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: async (): Promise<SubscriptionStatus> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase.functions.invoke('get-subscription-status', {
        body: { userId: user.id }
      });
      
      if (error) {
        console.error('Error fetching subscription status:', error);
        throw error;
      }
      
      return data;
    },
    retry: 1,
    refetchOnWindowFocus: false
  });
  
  return {
    subscription: data,
    isLoading,
    error,
    refetch
  };
}
