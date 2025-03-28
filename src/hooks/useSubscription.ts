
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cancelSubscription } from '@/services/stripe';

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
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: async (): Promise<SubscriptionStatus> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('get-subscription-status', {
        body: { userId: user.id },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`
        }
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
  
  const handleCancelSubscription = async () => {
    try {
      setCancelingSubscription(true);
      await cancelSubscription();
      await refetch();
      toast.success("Your subscription has been canceled successfully");
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error(error.message || "Failed to cancel subscription");
    } finally {
      setCancelingSubscription(false);
    }
  };
  
  return {
    subscription: data,
    isLoading,
    error,
    refetch,
    cancelingSubscription,
    handleCancelSubscription
  };
}
