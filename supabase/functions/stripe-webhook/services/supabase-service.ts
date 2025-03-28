
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { config } from "../config/config.ts";
import { log } from "../utils/logger.ts";

// Initialize Supabase client
export const supabase = createClient(
  config.supabase.url, 
  config.supabase.serviceRoleKey
);

// Update profile with subscription role
export async function updateProfileRole(userId: string, planId: string): Promise<boolean> {
  try {
    const role = planId === 'organization' ? 'organization' : 'athlete';
    
    log.debug(`Updating profile for user ${userId} with role ${role}`);
    
    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        user_id: userId, 
        role,
        updated_at: new Date().toISOString()
      });
      
    if (error) {
      log.error('Error updating profile with role:', error);
      return false;
    }
    
    log.info(`Successfully updated profile role to ${role} for user ${userId}`);
    return true;
  } catch (err) {
    log.error(`Error in updateProfileRole: ${err.message}`);
    return false;
  }
}

// Store or update subscription data
export async function storeSubscriptionData(
  userId: string,
  subscriptionId: string,
  customerId: string,
  planId: string,
  status: string
): Promise<boolean> {
  try {
    log.debug(`Storing subscription data for user ${userId}`);
    
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        plan_id: planId,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (error) {
      log.error('Error storing subscription data:', error);
      return false;
    }
    
    log.info(`Successfully stored subscription data for user ${userId}`);
    return true;
  } catch (err) {
    log.error(`Error in storeSubscriptionData: ${err.message}`);
    return false;
  }
}

// Update pending subscription to active
export async function updatePendingSubscription(
  subscriptionId: string,
  pendingSubscriptionId: string,
  customerId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingSubscriptionId);
      
    if (error) {
      log.error('Error updating pending subscription to active:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    log.error(`Error in updatePendingSubscription: ${err.message}`);
    return false;
  }
}

// Get pending subscription by user ID
export async function getPendingSubscription(userId: string) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows returned"
      log.error('Error checking for pending subscription:', error);
    }
    
    return { data, error };
  } catch (err) {
    log.error(`Error in getPendingSubscription: ${err.message}`);
    return { data: null, error: err };
  }
}

// Update subscription status
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscriptionId);
      
    if (error) {
      log.error(`Error updating subscription status to ${status}:`, error);
      return false;
    }
    
    log.info(`Successfully updated subscription status to ${status}`);
    return true;
  } catch (err) {
    log.error(`Error in updateSubscriptionStatus: ${err.message}`);
    return false;
  }
}

// Get subscription by ID
export async function getSubscriptionByStripeId(subscriptionId: string) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
      
    if (error) {
      log.error('Error fetching subscription:', error);
    }
    
    return { data, error };
  } catch (err) {
    log.error(`Error in getSubscriptionByStripeId: ${err.message}`);
    return { data: null, error: err };
  }
}

// Verify subscription created successfully
export async function verifySubscriptionCreated(userId: string) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
      
    if (error) {
      log.error('Verification check for subscription failed:', error);
      return false;
    } else if (data) {
      log.info('Subscription successfully verified in database:', data.id);
      return true;
    } else {
      log.error('Subscription verification failed: No active record found after operation');
      return false;
    }
  } catch (err) {
    log.error(`Error in verifySubscriptionCreated: ${err.message}`);
    return false;
  }
}
