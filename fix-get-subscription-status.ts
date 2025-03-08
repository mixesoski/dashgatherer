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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { userId } = await req.json();
    log.info(`Getting subscription status for user: ${userId}`);

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

        return new Response(
          JSON.stringify({
            active: subscription.status === 'active' || subscription.status === 'trialing',
            plan: subscriptionData.plan_id,
            status: subscription.status,
            role: userRole,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
            renewsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null
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
            renewsAt: null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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