
import { supabase } from '@/integrations/supabase/client';

export async function verifyStripeWebhookConfig() {
  try {
    const { data, error } = await supabase.functions.invoke('check-webhook-config');
    
    if (error) {
      console.error('Error verifying Stripe webhook config:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in verifyStripeWebhookConfig:', error);
    throw error;
  }
}

export async function createCheckoutSession(planId: string, successUrl: string, cancelUrl: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        planId,
        userId: user.id,
        successUrl,
        cancelUrl
      }
    });
    
    if (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in createCheckoutSession:', error);
    throw error;
  }
}

export async function cancelSubscription() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: {
        userId: user.id,
      }
    });
    
    if (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in cancelSubscription:', error);
    throw error;
  }
}
