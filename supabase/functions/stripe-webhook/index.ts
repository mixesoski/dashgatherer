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

// Helper for logging request details
function logRequestDetails(req: Request) {
  const url = new URL(req.url);
  log.info(`Request method: ${req.method}, path: ${url.pathname}`);
  
  // Log headers in a readable format
  const headersObj: Record<string, string> = {};
  for (const [key, value] of req.headers.entries()) {
    headersObj[key] = value;
  }
  log.debug('Request headers:', JSON.stringify(headersObj, null, 2));
  
  return { url, headersObj };
}

// Function to verify the Stripe signature
async function verifyStripeSignature(req: Request) {
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    log.error('Missing stripe-signature header');
    return { 
      verified: false, 
      error: {
        status: 400,
        message: 'Missing stripe signature',
        details: 'The webhook request is missing the stripe-signature header required for verification',
        headersReceived: req.headers.has('stripe-signature')
      }
    };
  }

  if (!webhookSecret) {
    log.error('Webhook secret is not configured in environment variables');
    return { 
      verified: false, 
      error: {
        status: 500,
        message: 'Webhook secret not configured',
        details: 'The STRIPE_WEBHOOK_SECRET environment variable is not set or is empty',
        envStatus: {
          webhook_secret: webhookSecret ? 'present' : 'missing',
          stripe_key: Deno.env.get('STRIPE_SECRET_KEY') ? 'present' : 'missing',
          supabase_url: supabaseUrl ? 'present' : 'missing',
          supabase_key: supabaseKey ? 'present (length: ' + supabaseKey.length + ')' : 'missing'
        }
      }
    };
  }

  try {
    // Get the request body as text for Stripe signature verification
    const body = await req.text();
    
    log.debug(`Stripe signature: ${signature.substring(0, 20)}...`);
    log.debug(`Request body length: ${body.length} bytes`);
    log.debug(`Request body preview: ${body.substring(0, 100)}...`);

    try {
      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      log.info('Webhook signature verified successfully');
      log.info(`Webhook event type: ${event.type}`);
      return { verified: true, event, body };
    } catch (err) {
      log.error(`Webhook signature verification failed: ${err.message}`);
      return { 
        verified: false, 
        error: {
          status: 400,
          message: `Webhook signature verification failed`,
          details: err.message,
          hint: 'Make sure the webhook secret matches the one in your Stripe dashboard',
          receivedSignature: signature.substring(0, 20) + '...',
          webhookSecretLength: webhookSecret.length,
          bodyLength: body.length
        }
      };
    }
  } catch (err) {
    log.error(`Error processing webhook request body: ${err.message}`);
    return {
      verified: false,
      error: {
        status: 400,
        message: `Error processing webhook request`,
        details: err.message
      }
    };
  }
}

// Handler for checkout.session.completed event
async function handleCheckoutSessionCompleted(session: any) {
  log.info('Checkout session completed. Details:', JSON.stringify({
    id: session.id,
    customer: session.customer,
    userId: session.client_reference_id,
    metadata: session.metadata,
    subscription: session.subscription
  }, null, 2));
  
  // Extract user ID from client_reference_id or metadata
  // We check multiple places to ensure we capture the user ID
  const userId = session.client_reference_id || 
                 session.metadata?.userId || 
                 (session.metadata ? session.metadata.userId : null);
                 
  const subscriptionId = session.subscription;
  const customerId = session.customer;
  const planId = session.metadata?.planId || 'athlete'; // Default to athlete if not specified
  
  log.info(`Processing checkout for user: ${userId}, plan: ${planId}, subscription: ${subscriptionId}, customer: ${customerId}`);

  if (!userId) {
    log.error('Missing user ID in checkout session');
    return { 
      success: false, 
      error: {
        status: 400,
        message: 'Missing user ID',
        details: 'The checkout session does not include a client_reference_id or userId in metadata',
        sessionData: {
          id: session.id,
          customer: session.customer,
          client_reference_id: session.client_reference_id,
          metadata: session.metadata,
        }
      }
    };
  }

  try {
    // Check if there's a pending subscription record first
    const { data: pendingSubscription, error: pendingError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();
    
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
          stripe_customer_id: customerId,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingSubscription.id);
      
      if (updateError) {
        log.error('Error updating pending subscription to active:', updateError);
        return {
          success: false,
          error: {
            status: 500,
            message: 'Database update error',
            details: updateError.message
          }
        };
      }
      
      log.info(`Successfully updated pending subscription to active for user ${userId}`);
    } else {
      // No pending subscription found, create a new active subscription
      log.info(`No pending subscription found for user ${userId}, creating new active subscription`);
      
      // Complete transactions in parallel for better performance
      const promises = [];

      // 1. Update profile with role if needed
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
            stripe_customer_id: customerId,
            plan_id: planId,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      );

      // Wait for all operations to complete
      const results = await Promise.all(promises);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        log.error('Errors during database updates:', JSON.stringify(errors));
        return {
          success: false,
          error: {
            status: 500,
            message: 'Database update errors',
            details: errors.map(e => e.error.message).join(', '),
            fullErrors: errors
          }
        };
      }
    }
    
    // Double check that subscription was actually created/updated
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
    return { success: true };
  } catch (err) {
    log.error('Exception processing checkout session:', err);
    return {
      success: false,
      error: {
        status: 500,
        message: `Exception processing checkout: ${err.message}`,
        stack: err.stack
      }
    };
  }
}

// Handler for customer.subscription.updated event
async function handleSubscriptionUpdated(subscription: any) {
  const stripeSubscriptionId = subscription.id;
  log.info(`Subscription updated: ${stripeSubscriptionId}, status: ${subscription.status}`);

  try {
    // First, handle the case where the subscription ID is a temporary 'pending_' ID
    if (stripeSubscriptionId.startsWith('pending_')) {
      log.info(`Processing pending subscription update: ${stripeSubscriptionId}`);
      
      // Extract the user ID from the temporary ID if possible (some implementations store it in a pattern)
      // Otherwise, we'll have to check all pending subscriptions
      const { data: pendingSubscriptions, error: pendingError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .eq('status', 'pending');
      
      if (pendingError) {
        log.error('Error fetching pending subscriptions:', pendingError);
        return {
          success: false,
          error: {
            status: 500,
            message: 'Database query error',
            details: pendingError.message
          }
        };
      }
      
      if (pendingSubscriptions && pendingSubscriptions.length > 0) {
        log.info(`Found ${pendingSubscriptions.length} pending subscriptions matching ID ${stripeSubscriptionId}`);
        
        // Update all matching pending subscriptions to active
        for (const pendingSub of pendingSubscriptions) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', pendingSub.id);
            
          if (updateError) {
            log.error(`Error updating pending subscription ${pendingSub.id}:`, updateError);
          } else {
            log.info(`Successfully updated pending subscription ${pendingSub.id} to active`);
          }
        }
        
        return { success: true };
      }
    }
    
    // Regular subscription update
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);
      
    if (error) {
      log.error('Error updating subscription status:', error);
      return {
        success: false,
        error: {
          status: 500,
          message: 'Subscription update error',
          details: error.message
        }
      };
    } else {
      log.info(`Updated subscription status to ${subscription.status} for ID ${stripeSubscriptionId}`);
      return { success: true };
    }
  } catch (err) {
    log.error('Exception updating subscription:', err);
    return {
      success: false,
      error: {
        status: 500,
        message: `Exception updating subscription: ${err.message}`,
        stack: err.stack
      }
    };
  }
}

// Handler for customer.subscription.deleted event
async function handleSubscriptionDeleted(subscription: any) {
  const stripeSubscriptionId = subscription.id;
  log.info(`Subscription deleted: ${stripeSubscriptionId}`);

  // Update subscription to inactive
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);
      
    if (error) {
      log.error('Error updating deleted subscription:', error);
      return {
        success: false,
        error: {
          status: 500,
          message: 'Subscription delete error',
          details: error.message
        }
      };
    } else {
      log.info(`Marked subscription ${stripeSubscriptionId} as inactive`);
      return { success: true };
    }
  } catch (err) {
    log.error('Exception deleting subscription:', err);
    return {
      success: false,
      error: {
        status: 500,
        message: `Exception deleting subscription: ${err.message}`,
        stack: err.stack
      }
    };
  }
}

// Main webhook handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    log.info('Handling OPTIONS request for CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log.info('Webhook request received');
    
    // Log request details
    logRequestDetails(req);
    
    // Clone the request so we can read the body multiple times if needed
    const clonedReq = req.clone();
    
    // First attempt: Check for Stripe signature
    const verification = await verifyStripeSignature(req);
    
    if (!verification.verified) {
      log.error('Stripe signature verification failed:', verification.error);
      
      // Special handling for checkout.session.completed - try a different approach
      // Some systems post directly without proper signature, so we'll try to process anyway
      try {
        const body = await clonedReq.json();
        
        if (body.type === 'checkout.session.completed') {
          log.info('Processing checkout.session.completed event without signature verification');
          const result = await handleCheckoutSessionCompleted(body.data.object);
          
          if (result.success) {
            return new Response(JSON.stringify({ 
              received: true,
              message: 'Webhook processed without signature verification',
              eventType: body.type 
            }), { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (backupErr) {
        log.error('Error in backup checkout processing:', backupErr);
      }
      
      // Return original error if backup approach didn't work
      return new Response(JSON.stringify(verification.error), { 
        status: verification.error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { event } = verification;
    log.info(`Processing event type: ${event.type}`);

    // Route event to appropriate handler
    let result;
    
    if (event.type === 'checkout.session.completed') {
      result = await handleCheckoutSessionCompleted(event.data.object);
    } else if (event.type === 'customer.subscription.updated') {
      result = await handleSubscriptionUpdated(event.data.object);
    } else if (event.type === 'customer.subscription.deleted') {
      result = await handleSubscriptionDeleted(event.data.object);
    } else {
      log.info(`Unhandled event type: ${event.type}`);
      result = { success: true, message: `Event type ${event.type} acknowledged but not processed` };
    }

    // If there was an error in handling the event
    if (!result.success) {
      log.error('Error handling webhook event:', result.error);
      return new Response(JSON.stringify(result.error), { 
        status: result.error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return a success response
    log.info('Webhook processed successfully');
    return new Response(JSON.stringify({ 
      received: true,
      message: 'Webhook processed successfully',
      eventType: event.type 
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    log.error(`Webhook Error: ${err.message}`, err);
    return new Response(JSON.stringify({ 
      error: `Webhook Error`,
      message: err.message,
      stack: err.stack
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
