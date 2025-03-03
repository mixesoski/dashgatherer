
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionPlan = 'coach' | 'athlete' | 'organization';

interface CreateCheckoutSessionParams {
  planId: SubscriptionPlan;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

export const createCheckoutSession = async ({
  planId,
  userId,
  successUrl,
  cancelUrl
}: CreateCheckoutSessionParams) => {
  try {
    // Call the Stripe checkout edge function
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        planId,
        userId,
        successUrl,
        cancelUrl
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const getSubscriptionStatus = async (userId: string) => {
  try {
    // Call the edge function to get subscription status
    const { data, error } = await supabase.functions.invoke('get-subscription-status', {
      body: { userId }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    throw error;
  }
};
