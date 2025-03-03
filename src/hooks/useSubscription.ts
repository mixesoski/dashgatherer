
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createCheckoutSession, getSubscriptionStatus, SubscriptionPlan } from '@/services/stripe';
import { supabase } from '@/integrations/supabase/client';

export const useSubscription = () => {
  const [loading, setLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        const session = await supabase.auth.getSession();
        if (session.data.session?.user) {
          const status = await getSubscriptionStatus(session.data.session.user.id);
          setSubscriptionStatus(status);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      }
    };

    fetchSubscriptionStatus();
  }, []);

  const subscribeToPlan = async (planId: SubscriptionPlan) => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session?.user) {
        toast.error('You must be logged in to subscribe');
        navigate('/login');
        return;
      }

      const userId = session.data.session.user.id;
      
      // Define the URLs that Stripe will redirect to after checkout
      const successUrl = `${window.location.origin}/dashboard?subscription=success`;
      const cancelUrl = `${window.location.origin}/dashboard?subscription=cancelled`;
      
      const { url } = await createCheckoutSession({
        planId,
        userId,
        successUrl,
        cancelUrl
      });
      
      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error subscribing to plan:', error);
      toast.error('Failed to process subscription');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    subscriptionStatus,
    subscribeToPlan
  };
};
