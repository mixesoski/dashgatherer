
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

// Enhanced logging for debugging
const LOG_LEVEL = 'debug'; // 'debug' | 'info' | 'error'

const log = {
  debug: (...args: any[]) => {
    if (LOG_LEVEL === 'debug') {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'info') {
      console.log('[INFO]', ...args);
    }
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const projectRef = Deno.env.get('SUPABASE_PROJECT_REF') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { userId } = await req.json();
    log.info(`Getting subscription status for user: ${userId}`);

    // Log correct webhook URL format
    if (projectRef) {
      const correctWebhookUrl = `https://${projectRef}.functions.supabase.co/stripe-webhook`;
      log.debug(`Correct webhook URL format: ${correctWebhookUrl}`);
    }

    // Verify userId is provided
    if (!userId) {
      log.error('No user ID provided');
      throw new Error('User ID is required');
    }

    // Check if the user is in the profiles table and get their role
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      log.debug(`No profile found for user ${userId}`);
      // We'll continue, as they might still have a subscription but no profile yet
    }

    // Get user's role from profile data or default to 'athlete'
    const userRole = profileData?.role || 'athlete';
    log.debug(`User role from profiles: ${userRole}`);

    // Check if user has an active subscription
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (subscriptionError) {
      log.error(`Error fetching subscription: ${subscriptionError.message}`);
      
      // If the subscriptions table doesn't exist yet, return a default response
      if (subscriptionError.code === '42P01') { // Table doesn't exist
        log.info('Subscriptions table does not exist yet');
        return new Response(
          JSON.stringify({
            active: false,
            plan: null,
            status: 'no_subscription',
            role: userRole,
            trialEnd: null,
            cancelAt: null,
            renewsAt: null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw subscriptionError;
    }

    // Check for pending subscriptions
    if (!subscriptionData) {
      const { data: pendingSubscriptionData, error: pendingError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (pendingSubscriptionData && !pendingError) {
        log.info(`Found pending subscription for user ${userId}`);

        // Special handling for subscriptions that should be active but are still marked pending
        // If the stripe_subscription_id doesn't start with 'pending_', it means the webhook didn't update it properly
        if (pendingSubscriptionData.stripe_subscription_id && 
            !pendingSubscriptionData.stripe_subscription_id.startsWith('pending_')) {
          
          try {
            // Try to check the subscription status directly with Stripe
            const subscription = await stripe.subscriptions.retrieve(
              pendingSubscriptionData.stripe_subscription_id
            );
            
            if (subscription.status === 'active' || subscription.status === 'trialing') {
              // Update the subscription to active since we confirmed it with Stripe
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  status: subscription.status,
                  updated_at: new Date().toISOString()
                })
                .eq('id', pendingSubscriptionData.id);
              
              if (updateError) {
                log.error(`Error updating pending subscription to active: ${updateError.message}`);
              } else {
                log.info(`Successfully updated subscription to ${subscription.status} from pending`);
                
                return new Response(
                  JSON.stringify({
                    active: true,
                    plan: pendingSubscriptionData.plan_id,
                    status: subscription.status,
                    role: userRole,
                    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                    cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
                    renewsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
                    stripeSubscriptionId: pendingSubscriptionData.stripe_subscription_id
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          } catch (stripeError) {
            // If we can't reach Stripe or the subscription doesn't exist, continue with the pending status
            log.error(`Error retrieving Stripe subscription: ${stripeError.message}`);
          }
        }
        
        return new Response(
          JSON.stringify({
            active: false,
            plan: pendingSubscriptionData.plan_id,
            status: 'pending',
            role: userRole,
            trialEnd: null,
            cancelAt: null,
            renewsAt: null,
            pendingCheckout: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    log.debug(`Subscription data: ${JSON.stringify(subscriptionData)}`);

    // If we have a subscription in the database and it's connected to Stripe
    if (subscriptionData?.stripe_subscription_id) {
      try {
        // Fetch the latest subscription status from Stripe
        log.debug(`Fetching subscription from Stripe: ${subscriptionData.stripe_subscription_id}`);
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionData.stripe_subscription_id
        );
        
        log.debug(`Stripe subscription data: ${JSON.stringify(subscription)}`);

        // Update our local database if the status has changed
        if (subscription.status !== subscriptionData.status) {
          log.info(`Updating subscription status from ${subscriptionData.status} to ${subscription.status}`);
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: subscription.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', subscriptionData.id);
            
          if (updateError) {
            log.error(`Error updating subscription status: ${updateError.message}`);
          }
        }

        return new Response(
          JSON.stringify({
            active: subscription.status === 'active' || subscription.status === 'trialing',
            plan: subscriptionData.plan_id,
            status: subscription.status,
            role: userRole,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
            renewsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
            stripeSubscriptionId: subscriptionData.stripe_subscription_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (stripeError) {
        log.error(`Error retrieving Stripe subscription: ${stripeError.message}`);
        
        // If we can't reach Stripe, use the local data
        return new Response(
          JSON.stringify({
            active: subscriptionData.status === 'active' || subscriptionData.status === 'trialing',
            plan: subscriptionData.plan_id,
            status: subscriptionData.status,
            role: userRole,
            trialEnd: null,
            cancelAt: null,
            renewsAt: null,
            stripeSubscriptionId: subscriptionData.stripe_subscription_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if user has coach role (which gets premium access)
    if (userRole === 'coach') {
      log.info(`User ${userId} has coach role with premium access`);
      return new Response(
        JSON.stringify({
          active: true,
          plan: 'coach',
          status: 'active',
          role: 'coach',
          trialEnd: null,
          cancelAt: null,
          renewsAt: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default response for users without a subscription
    log.info(`No subscription found for user ${userId}`);
    return new Response(
      JSON.stringify({
        active: false,
        plan: null,
        status: 'no_subscription',
        role: userRole,
        trialEnd: null,
        cancelAt: null,
        renewsAt: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log.error(`Error getting subscription status: ${error.message}`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
