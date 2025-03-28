
import { supabase } from '@/integrations/supabase/client';

export async function verifyStripeWebhookConfig() {
  try {
    const { data, error } = await supabase.functions.invoke('check-webhook-config', {
      headers: {
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      }
    });
    
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
    
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        planId,
        userId: user.id,
        successUrl,
        cancelUrl
      },
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token}`
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
    
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: {
        userId: user.id,
      },
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token}`
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

export async function getSubscriptionStatus() {
  try {
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
  } catch (error) {
    console.error('Error in getSubscriptionStatus:', error);
    throw error;
  }
}
