
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

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
  console.log(`Request method: ${req.method}, path: ${url.pathname}`);
  
  // Log headers in a readable format
  const headersObj = {};
  for (const [key, value] of req.headers.entries()) {
    headersObj[key] = value;
  }
  console.log('Request headers:', JSON.stringify(headersObj, null, 2));
  
  return { url, headersObj };
}

// Function to verify the Stripe signature
async function verifyStripeSignature(req: Request) {
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    console.error('Missing stripe-signature header');
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
    console.error('Webhook secret is not configured in environment variables');
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

  // Get the request body as text for Stripe signature verification
  const body = await req.text();
  
  // Debug: Log the signature and first part of the body
  console.log(`Stripe signature: ${signature.substring(0, 20)}...`);
  console.log(`Request body length: ${body.length} bytes`);
  console.log(`Request body preview: ${body.substring(0, 100)}...`);

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log('Webhook signature verified successfully');
    console.log(`Webhook event type: ${event.type}`);
    return { verified: true, event, body };
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
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
}

// Handler for checkout.session.completed event
async function handleCheckoutSessionCompleted(session: any) {
  console.log('Checkout session completed. Details:', JSON.stringify({
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
  
  console.log(`Processing checkout for user: ${userId}, plan: ${planId}, subscription: ${subscriptionId}, customer: ${customerId}`);

  if (!userId) {
    console.error('Missing user ID in checkout session (client_reference_id and metadata.userId are null)');
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

  // Verify 'subscriptions' table exists
  try {
    const { error: tableCheckError } = await supabase
      .from('subscriptions')
      .select('id')
      .limit(1);
      
    if (tableCheckError) {
      console.error('Error verifying subscriptions table:', tableCheckError);
      return {
        success: false,
        error: {
          status: 500,
          message: 'Database configuration error',
          details: 'Could not access subscriptions table',
          dbError: tableCheckError.message
        }
      };
    }
  } catch (tableCheckErr) {
    console.error('Exception checking subscriptions table:', tableCheckErr);
    return {
      success: false,
      error: {
        status: 500,
        message: 'Exception checking database',
        details: tableCheckErr.message
      }
    };
  }

  // Verify user exists
  try {
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (userError) {
      console.error('Error checking user existence:', userError);
      return {
        success: false,
        error: {
          status: 500,
          message: 'User lookup error',
          details: userError.message
        }
      };
    }
    
    // If user not found in profiles table, try to check auth.users directly
    if (!userData) {
      console.log('User not found in profiles table, will create subscription anyway but log a warning');
    }
  } catch (userCheckError) {
    console.error('Error checking user existence:', userCheckError);
    // Continue anyway - we'll attempt to create the subscription
    console.log('Will attempt to create subscription despite user check error');
  }

  // Update profile and subscription
  try {
    // Complete transactions in parallel for better performance
    const promises = [];

    // 1. Update profile with role
    if (userId) {
      console.log(`Updating profile for user ${userId} with role ${planId === 'organization' ? 'organization' : 'athlete'}`);
      promises.push(
        supabase
          .from('profiles')
          .upsert({ 
            user_id: userId, 
            role: planId === 'organization' ? 'organization' : 'athlete',
            updated_at: new Date().toISOString()
          })
      );
    }

    // 2. Store subscription data - using upsert for safety
    console.log(`Storing subscription data for user ${userId}`);
    const subscriptionData = {
      user_id: userId,
      stripe_subscription_id: subscriptionId || `one_time_${Date.now()}`,
      stripe_customer_id: customerId,
      plan_id: planId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    promises.push(
      supabase
        .from('subscriptions')
        .upsert(subscriptionData)
    );

    // Wait for all operations to complete
    const results = await Promise.all(promises);
    
    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Errors during database updates:', JSON.stringify(errors));
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
    
    console.log('Successfully processed checkout.session.completed');
    return { success: true };
  } catch (err) {
    console.error('Exception processing checkout session:', err);
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
  console.log(`Subscription updated: ${stripeSubscriptionId}, status: ${subscription.status}`);

  // Simple update to subscription table
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);
      
    if (error) {
      console.error('Error updating subscription status:', error);
      return {
        success: false,
        error: {
          status: 500,
          message: 'Subscription update error',
          details: error.message
        }
      };
    } else {
      console.log(`Updated subscription status to ${subscription.status} for ID ${stripeSubscriptionId}`);
      return { success: true };
    }
  } catch (err) {
    console.error('Exception updating subscription:', err);
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
  console.log(`Subscription deleted: ${stripeSubscriptionId}`);

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
      console.error('Error updating deleted subscription:', error);
      return {
        success: false,
        error: {
          status: 500,
          message: 'Subscription delete error',
          details: error.message
        }
      };
    } else {
      console.log(`Marked subscription ${stripeSubscriptionId} as inactive`);
      return { success: true };
    }
  } catch (err) {
    console.error('Exception deleting subscription:', err);
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
    console.log('Handling OPTIONS request for CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Webhook request received');
    
    // Log request details
    logRequestDetails(req);
    
    // Verify Stripe signature and get event
    const verification = await verifyStripeSignature(req);
    
    if (!verification.verified) {
      return new Response(JSON.stringify(verification.error), { 
        status: verification.error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { event } = verification;

    // Route event to appropriate handler
    let result;
    
    if (event.type === 'checkout.session.completed') {
      result = await handleCheckoutSessionCompleted(event.data.object);
    } else if (event.type === 'customer.subscription.updated') {
      result = await handleSubscriptionUpdated(event.data.object);
    } else if (event.type === 'customer.subscription.deleted') {
      result = await handleSubscriptionDeleted(event.data.object);
    } else {
      console.log(`Unhandled event type: ${event.type}`);
      result = { success: true, message: `Event type ${event.type} acknowledged but not processed` };
    }

    // If there was an error in handling the event
    if (!result.success) {
      return new Response(JSON.stringify(result.error), { 
        status: result.error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return a success response
    return new Response(JSON.stringify({ 
      received: true,
      message: 'Webhook processed successfully',
      eventType: event.type 
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
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
