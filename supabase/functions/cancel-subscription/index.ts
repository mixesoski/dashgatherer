
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

// Get the project ID for correct URL construction
const projectId = Deno.env.get('SUPABASE_PROJECT_REF') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { subscriptionId, userId } = await req.json();

    if (!subscriptionId) {
      throw new Error('Subscription ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    log.info(`Canceling subscription ${subscriptionId} for user ${userId}`);

    // Verify that this subscription belongs to the user
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('user_id', userId)
      .single();

    if (subscriptionError || !subscriptionData) {
      log.error(`Error verifying subscription ownership: ${subscriptionError?.message || 'No subscription found'}`);
      throw new Error('Subscription not found or does not belong to this user');
    }

    // Cancel the subscription in Stripe
    log.info(`Canceling Stripe subscription: ${subscriptionId}`);
    const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

    // Update the subscription status in our database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscriptionId)
      .eq('user_id', userId);

    if (updateError) {
      log.error(`Error updating subscription status in database: ${updateError.message}`);
      // We'll still return success as the subscription was canceled in Stripe
    }

    // Note that subscription cancellations should also be processed by the webhook
    if (projectId) {
      log.info(`Ensure webhook is properly configured at https://${projectId}.functions.supabase.co/stripe-webhook`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription canceled successfully',
        status: canceledSubscription.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log.error(`Error in cancel-subscription function: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
