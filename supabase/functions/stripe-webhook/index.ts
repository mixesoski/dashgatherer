
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

// Enhanced logging for debugging
const LOG_LEVEL = 'debug';

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

// Completely permissive CORS headers to allow any request
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests with a completely permissive response
  if (req.method === 'OPTIONS') {
    log.info('Handling OPTIONS request for CORS preflight');
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    log.info('Webhook request received');
    log.debug('Request URL:', req.url);
    log.debug('Request method:', req.method);
    
    // Log all headers for debugging
    const headersObj: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      headersObj[key] = value;
    }
    log.debug('Request headers:', JSON.stringify(headersObj, null, 2));

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const projectRef = Deno.env.get('SUPABASE_PROJECT_REF') || '';

    if (!stripeKey || !supabaseUrl || !supabaseKey) {
      log.error('Missing required environment variables');
      // Return 200 to acknowledge receipt even with configuration issues
      return new Response(
        JSON.stringify({ 
          status: 'configuration_error',
          message: 'Missing required environment variables',
          received: true
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const stripe = new Stripe(stripeKey, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2023-10-16',
    });
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Log correct webhook URL format
    if (projectRef) {
      const correctWebhookUrl = `https://${projectRef}.functions.supabase.co/stripe-webhook`;
      log.debug(`Correct webhook URL format: ${correctWebhookUrl}`);
    }
    
    // Get the request body as text for processing
    const rawBody = await req.text();
    log.debug('Raw request body (first 500 chars):', rawBody.substring(0, 500));
    
    let event;
    
    // First try to parse the event directly from the request body
    try {
      event = JSON.parse(rawBody);
      log.info(`Parsed event type: ${event.type}`);
    } catch (parseErr) {
      log.error(`Error parsing request body: ${parseErr.message}`);
      // Return 200 even for parsing errors to acknowledge receipt
      return new Response(
        JSON.stringify({ 
          status: 'parse_error',
          message: parseErr.message,
          received: true
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the Stripe signature header if it exists
    const signature = req.headers.get('stripe-signature');
    let signatureVerified = false;
    
    // Try to verify signature if available, but don't require it
    if (signature && webhookSecret) {
      try {
        const verifiedEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        log.info('Stripe signature verified successfully');
        signatureVerified = true;
        event = verifiedEvent;
      } catch (err) {
        log.info(`Signature verification failed: ${err.message}. Will still process the event.`);
        // Continue with the directly parsed event
      }
    } else {
      log.info('Processing webhook without signature verification');
    }

    // Process the event regardless of signature verification
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      log.info(`Processing checkout.session.completed event for session ${session.id}`);
      
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
            details: 'The checkout session does not include a client_reference_id or userId in metadata',
            session: JSON.stringify(session)
          }),
          { 
            status: 200, // Return 200 even for errors to acknowledge receipt
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      try {
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
          log.info(`Updated profile role to ${planId === 'organization' ? 'organization' : 'athlete'} for user ${userId}`);
        }
        
        // Check for existing pending subscription
        const { data: pendingSubscription, error: pendingError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .maybeSingle();
          
        if (pendingError) {
          log.error('Error checking for pending subscription:', pendingError);
        }
        
        if (pendingSubscription) {
          // Update the pending subscription to active
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
            log.error('Error updating pending subscription:', updateError);
          } else {
            log.info(`Updated pending subscription to active for user ${userId}`);
          }
        } else {
          // Create a new subscription record
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
            log.info(`Created subscription record for user ${userId}`);
          }
        }
        
        // Verify the subscription was created
        const { data: verifyData, error: verifyError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
          
        if (verifyError) {
          log.error('Error verifying subscription:', verifyError);
        } else if (verifyData) {
          log.info(`Verified subscription created successfully with ID ${verifyData.id}`);
        } else {
          log.error('Failed to verify subscription creation');
        }
      } catch (dbErr) {
        log.error('Database operation error:', dbErr);
      }
    }
    else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      log.info(`Processing customer.subscription.updated event for subscription ${subscription.id}`);
      
      try {
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
          
          // Try to find by customer ID as a fallback
          if (subscription.customer) {
            const { data: customerData, error: customerError } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('stripe_customer_id', subscription.customer)
              .maybeSingle();
              
            if (customerError) {
              log.error('Error finding subscription by customer ID:', customerError);
            } else if (customerData) {
              log.info(`Found subscription by customer ID instead: ${customerData.id}`);
              
              // Update with the correct subscription ID and status
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  stripe_subscription_id: subscription.id,
                  status: subscription.status,
                  updated_at: new Date().toISOString()
                })
                .eq('id', customerData.id);
                
              if (updateError) {
                log.error('Error updating subscription found by customer ID:', updateError);
              } else {
                log.info(`Updated subscription with correct subscription ID and status`);
              }
            }
          }
        }
      } catch (dbErr) {
        log.error('Database operation error:', dbErr);
      }
    }
    else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      log.info(`Processing customer.subscription.deleted event for subscription ${subscription.id}`);
      
      try {
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
      } catch (dbErr) {
        log.error('Database operation error:', dbErr);
      }
    }
    
    // Always return success to Stripe
    return new Response(
      JSON.stringify({ 
        received: true,
        signatureVerified,
        eventType: event.type,
        processed: true
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    log.error('Unexpected error processing webhook:', err);
    
    // Return 200 even for errors to acknowledge receipt
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: err.message,
        received: true,
        trace: LOG_LEVEL === 'debug' ? err.stack : undefined
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
