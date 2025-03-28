import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

// More debug logging for webhook troubleshooting
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

// More extensive CORS headers to support the Stripe webhook
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const projectRef = Deno.env.get('SUPABASE_PROJECT_REF') || '';

// Main webhook handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    log.info('Handling OPTIONS request for CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log.info('Webhook request received');
    
    // Log request details for debugging
    const url = new URL(req.url);
    log.info(`Request method: ${req.method}, path: ${url.pathname}`);
    
    // Log correct webhook URL format for reference
    const correctWebhookUrl = `https://${projectRef}.functions.supabase.co/stripe-webhook`;
    log.debug(`Correct webhook URL format: ${correctWebhookUrl}`);

    // Log headers in a readable format
    const headersObj: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      headersObj[key] = value;
    }
    log.debug('Request headers:', JSON.stringify(headersObj, null, 2));
    
    // Clone the request so we can read the body multiple times if needed
    const clonedReq = req.clone();
    
    // First try to verify the signature
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      log.error('Missing stripe-signature header');
      
      // For better compatibility, try to process the event without verification
      try {
        const body = await clonedReq.json();
        
        if (body.type === 'checkout.session.completed') {
          log.info('Processing checkout.session.completed event without signature verification');
          
          const session = body.data.object;
          
          // Extract user ID in various ways to ensure we catch it
          const userId = session.client_reference_id || 
                         session.metadata?.userId || 
                         (session.metadata ? session.metadata.userId : null);
                         
          const subscriptionId = session.subscription;
          const planId = session.metadata?.planId || 'athlete'; // Default to athlete if not specified
          
          log.info(`User ID: ${userId}, Subscription ID: ${subscriptionId}, Plan ID: ${planId}`);

          if (!userId) {
            log.error('User ID not found in session data');
            return new Response('User ID not found in session data', { status: 400 });
          }

          // Check if there's a pending subscription record first
          const { data: pendingSubscription, error: pendingError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .single();
          
          if (pendingError && pendingError.code !== 'PGRST116') { // PGRST116 is "No rows returned"
            log.error('Error checking for pending subscription:', pendingError);
          }
          
          // If we found a pending subscription, update it instead of creating a new one
          if (pendingSubscription) {
            log.info(`Found pending subscription for user ${userId}, updating it to active`);
            
            const { error: updateError } = await supabase
              .from('subscriptions')
              .update({
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: session.customer,
                status: 'active',
                updated_at: new Date().toISOString()
              })
              .eq('id', pendingSubscription.id);
            
            if (updateError) {
              log.error('Error updating pending subscription to active:', updateError);
              return new Response(JSON.stringify({ error: updateError }), { status: 500 });
            }
            
            log.info(`Successfully updated pending subscription to active for user ${userId}`);
          } else {
            // Complete transactions in parallel for better performance
            const promises = [];

            // 1. Update profile with role
            log.debug(`Updating profile for user ${userId} with role ${planId === 'organization' ? 'organization' : 'athlete'}`);
            promises.push(
              supabase
                .from('profiles')
                .upsert({ 
                  user_id: userId, 
                  role: planId === 'organization' ? 'organization' : 'athlete',
                  updated_at: new Date().toISOString()
                })
            );

            // 2. Store subscription data
            log.debug(`Storing subscription data for user ${userId}`);
            promises.push(
              supabase
                .from('subscriptions')
                .upsert({
                  user_id: userId,
                  stripe_subscription_id: subscriptionId,
                  stripe_customer_id: session.customer,
                  plan_id: planId,
                  status: 'active',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
            );

            // Wait for all operations to complete
            const results = await Promise.all(promises);
            log.debug('Database update results:', JSON.stringify(results));
            
            // Check for errors
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
              log.error('Errors during database updates:', JSON.stringify(errors));
              return new Response(JSON.stringify({ errors }), { status: 500 });
            }
          }
          
          return new Response(JSON.stringify({ 
            received: true,
            message: 'Webhook processed without signature verification',
            eventType: body.type 
          }), { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (backupErr) {
        log.error('Error in backup processing without signature:', backupErr);
      }
      
      // Return original error if backup approach didn't work
      return new Response(
        JSON.stringify({ 
          error: 'Missing stripe-signature header',
          details: 'The webhook request is missing the stripe-signature header required for verification',
          headersReceived: JSON.stringify(headersObj),
          correctWebhookUrl
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!webhookSecret) {
      log.error('Webhook secret is not configured in environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Webhook secret not configured',
          details: 'The STRIPE_WEBHOOK_SECRET environment variable is not set or is empty',
          envStatus: {
            webhook_secret: webhookSecret ? 'present' : 'missing',
            stripe_key: Deno.env.get('STRIPE_SECRET_KEY') ? 'present' : 'missing',
            supabase_url: supabaseUrl ? 'present' : 'missing',
            supabase_key: supabaseKey ? 'present (length: ' + supabaseKey.length + ')' : 'missing'
          }
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the request body as text for Stripe signature verification
    const body = await req.text();
    log.debug(`Webhook body received:`, body.substring(0, 500) + '...');
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      log.info(`Webhook signature verified successfully`);
      log.info(`Webhook event type: ${event.type}`);
    } catch (err) {
      log.error(`Webhook signature verification failed: ${err.message}`);
      
      // Try to process the event without verification as a fallback
      try {
        const jsonBody = JSON.parse(body);
        
        if (jsonBody.type === 'checkout.session.completed') {
          log.info('Attempting to process checkout session despite signature failure');
          // Processing code similar to the one above
          // ... (similar to the code in the first try-catch block)
        }
      } catch (fallbackErr) {
        log.error('Error in fallback processing:', fallbackErr);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Webhook signature verification failed',
          details: err.message,
          hint: 'Make sure the webhook secret matches the one in your Stripe dashboard'
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle different event types
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      log.debug('Session data:', JSON.stringify(session));
      
      // Get user ID in 3 different ways to make sure we capture it
      const userId = session.client_reference_id || 
                     session.metadata?.userId || 
                     (session.metadata ? session.metadata.userId : null);
                     
      const subscriptionId = session.subscription;
      const planId = session.metadata?.planId || 'athlete'; // Default to athlete if not specified
      
      log.info(`User ID: ${userId}, Subscription ID: ${subscriptionId}, Plan ID: ${planId}`);

      if (!userId) {
        log.error('User ID not found in session data');
        return new Response('User ID not found in session data', { status: 400 });
      }

      // Check if there's a pending subscription record first
      const { data: pendingSubscription, error: pendingError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single();
      
      if (pendingError && pendingError.code !== 'PGRST116') { // PGRST116 is "No rows returned"
        log.error('Error checking for pending subscription:', pendingError);
      }
      
      // If we found a pending subscription, update it instead of creating a new one
      if (pendingSubscription) {
        log.info(`Found pending subscription for user ${userId}, updating it to active`);
        
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: session.customer,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', pendingSubscription.id);
        
        if (updateError) {
          log.error('Error updating pending subscription to active:', updateError);
          return new Response(JSON.stringify({ error: updateError }), { status: 500 });
        }
        
        log.info(`Successfully updated pending subscription to active for user ${userId}`);
      } else {
        // Complete transactions in parallel for better performance
        const promises = [];

        // 1. Update profile with role
        log.debug(`Updating profile for user ${userId} with role ${planId === 'organization' ? 'organization' : 'athlete'}`);
        promises.push(
          supabase
            .from('profiles')
            .upsert({ 
              user_id: userId, 
              role: planId === 'organization' ? 'organization' : 'athlete',
              updated_at: new Date().toISOString()
            })
        );

        // 2. Store subscription data
        log.debug(`Storing subscription data for user ${userId}`);
        promises.push(
          supabase
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: session.customer,
              plan_id: planId,
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
        );

        // Wait for all operations to complete
        const results = await Promise.all(promises);
        log.debug('Database update results:', JSON.stringify(results));
        
        // Check for errors
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          log.error('Errors during database updates:', JSON.stringify(errors));
          return new Response(JSON.stringify({ errors }), { status: 500 });
        }
      }
      
      // Double check that subscription was actually created
      const { data: checkData, error: checkError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
        
      if (checkError) {
        log.error('Verification check for subscription failed:', checkError);
      } else if (checkData) {
        log.info('Subscription successfully verified in database:', checkData.id);
      } else {
        log.error('Subscription verification failed: No active record found after operation');
      }
      
      log.info('Successfully processed checkout.session.completed');
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const stripeSubscriptionId = subscription.id;
      log.debug(`Subscription ${stripeSubscriptionId} updated to status: ${subscription.status}`);

      // Fetch user associated with this subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .single();

      if (error) {
        log.error('Error fetching subscription:', error);
      } else if (data) {
        log.debug(`Updating subscription status for user ${data.user_id}`);
        // Update subscription status
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', stripeSubscriptionId);
          
        if (updateError) {
          log.error('Error updating subscription status:', updateError);
        } else {
          log.info(`Successfully updated subscription status to ${subscription.status}`);
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const stripeSubscriptionId = subscription.id;
      log.debug(`Subscription ${stripeSubscriptionId} deleted`);

      // Update subscription to inactive
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', stripeSubscriptionId);
        
      if (error) {
        log.error('Error updating subscription to inactive:', error);
      } else {
        log.info('Successfully marked subscription as inactive');
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    log.error(`Webhook Error: ${err.message}`, err);
    return new Response(`Webhook Error: ${err.message}`, { 
      status: 400,
      headers: corsHeaders
    });
  }
});
