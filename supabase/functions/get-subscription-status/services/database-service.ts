
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { config } from "../config/config.ts";
import { log } from "../utils/logger.ts";

// Initialize Supabase client
export const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Fetch user profile from database
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single();
    
  if (error) {
    log.debug(`No profile found for user ${userId}`);
  }
  
  return { data, error };
}

// Fetch active subscription from database
export async function getActiveSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
    
  if (error && error.code !== '42P01') { // Ignore table doesn't exist error
    log.error(`Error fetching subscription: ${error.message}`);
  }
  
  return { data, error };
}

// Fetch pending subscription from database
export async function getPendingSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
    
  return { data, error };
}

// Update subscription status in database
export async function updateSubscriptionStatus(subscriptionId: string, status: string) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', subscriptionId);
    
  if (error) {
    log.error(`Error updating subscription status: ${error.message}`);
    return false;
  }
  
  return true;
}
