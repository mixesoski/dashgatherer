
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

// Enhanced logging for debugging
const LOG_LEVEL = 'info'; // 'debug' | 'info' | 'error'

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

// CORS headers for the webhook endpoint
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    log.info('Handling OPTIONS request for CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log.info('Webhook request received');
    
    // Initialize environment variables and clients
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!stripeKey || !supabaseUrl || !supabaseKey) {
      log.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Configuration error',
          details: 'Missing required environment variables',
          status: 'stripe_key: ' + (stripeKey ? 'present' : 'missing') + 
                  ', supabase_url: ' + (supabaseUrl ? 'present' : 'missing') +
                  ', supabase_key: ' + (supabaseKey ? 'present' : 'missing')
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Initialize clients
    const stripe = new Stripe(stripeKey, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2023-10-16',
    });
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the request body as text for processing
    const body = await req.text();
    let event;
    
    // First try to parse the event directly from the request body
    try {
      event = JSON.parse(body);
      log.info(`Parsed event type: ${event.type}`);
    } catch (parseErr) {
      log.error(`Error parsing request body: ${parseErr.message}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON',
          details: parseErr.message
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the Stripe signature header if it exists
    const signature = req.headers.get('stripe-signature');
    let signatureVerified = false;
    
    // Verify the signature if possible
    if (signature && webhookSecret) {
      try {
        const verifiedEvent = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        log.info('Stripe signature verified successfully');
        signatureVerified = true;
        // Update the event with the verified one
        event = verifiedEvent;
      } catch (err) {
        log.info(`Signature verification failed: ${err.message}. Will still process the event.`);
        // Continue with the directly parsed event
      }
    } else if (!signature) {
      log.info('No stripe-signature header. Proceeding with unverified event.');
    } else if (!webhookSecret) {
      log.info('No webhook secret configured. Proceeding with unverified event.');
    }
    
    // Process the Stripe event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      log.info(`Processing checkout.session.completed event`);
      
      // Extract user ID from the session data
      const userId = session.client_reference_id || 
                    session.metadata?.userId || 
                    (session.metadata ? session.metadata.userId : null);
      
      const subscriptionId = session.subscription;
      const planId = session.metadata?.planId || 'athlete';
      
      log.info(`User ID: ${userId}, Subscription ID: ${subscriptionId}, Plan ID: ${planId}`);
      
      if (!userId) {
        log.error('User ID not found in session data');
        return new Response(
          JSON.stringify({
            error: 'User ID not found',
            details: 'The checkout session does not include a client_reference_id or userId in metadata'
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Update profile to set role
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          role: planId === 'organization' ? 'organization' : 'athlete',
          updated_at: new Date().toISOString()
        });
        
      if (profileError) {
        log.error('Error updating profile:', profileError);
      } else {
        log.info(`Updated profile role to ${planId} for user ${userId}`);
      }
      
      // Create or update subscription record
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: session.customer,
          plan_id: planId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (subscriptionError) {
        log.error('Error creating subscription record:', subscriptionError);
      } else {
        log.info(`Created/updated subscription record for user ${userId}`);
      }
    }
    else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      log.info(`Processing customer.subscription.updated event for subscription ${subscription.id}`);
      
      // Find the subscription in our database
      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle();
        
      if (subsError) {
        log.error('Error finding subscription:', subsError);
      } else if (subsData) {
        // Update the subscription status
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', subsData.id);
          
        if (updateError) {
          log.error('Error updating subscription status:', updateError);
        } else {
          log.info(`Updated subscription status to ${subscription.status}`);
        }
      } else {
        log.info(`No subscription found with ID ${subscription.id}`);
      }
    }
    else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      log.info(`Processing customer.subscription.deleted event for subscription ${subscription.id}`);
      
      // Update the subscription status to inactive
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscription.id);
        
      if (error) {
        log.error('Error updating subscription status to inactive:', error);
      } else {
        log.info(`Successfully marked subscription ${subscription.id} as inactive`);
      }
    }
    
    // Return a success response
    return new Response(
      JSON.stringify({ 
        received: true,
        signatureVerified,
        eventType: event.type
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    log.error('Unexpected error processing webhook:', err);
    
    return new Response(
      JSON.stringify({ 
        error: 'Webhook Error',
        message: err.message,
        stack: err.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
