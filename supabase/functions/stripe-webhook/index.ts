
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request for CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Webhook request received');
    
    // Log request method and path
    const url = new URL(req.url);
    console.log(`Request method: ${req.method}, path: ${url.pathname}`);
    
    // For debugging: Log headers in a readable format
    const headersObj = {};
    for (const [key, value] of req.headers.entries()) {
      headersObj[key] = value;
    }
    console.log('Request headers:', JSON.stringify(headersObj, null, 2));
    
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(JSON.stringify({ 
        error: 'Missing stripe signature',
        message: 'The webhook request is missing the stripe-signature header required for verification',
        received_headers: Object.keys(headersObj).join(', ')
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!webhookSecret) {
      console.error('Webhook secret is not configured in environment variables');
      return new Response(JSON.stringify({ 
        error: 'Webhook secret not configured',
        message: 'The STRIPE_WEBHOOK_SECRET environment variable is not set or is empty',
        env_vars_status: {
          webhook_secret: webhookSecret ? 'present' : 'missing',
          stripe_key: Deno.env.get('STRIPE_SECRET_KEY') ? 'present' : 'missing',
          supabase_url: supabaseUrl ? 'present' : 'missing',
          supabase_key: supabaseKey ? 'present (length: ' + supabaseKey.length + ')' : 'missing'
        }
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the request body as text for Stripe signature verification
    const body = await req.text();
    
    // Debug: Log the signature and first part of the body
    console.log(`Stripe signature: ${signature.substring(0, 20)}...`);
    console.log(`Request body length: ${body.length} bytes`);
    console.log(`Request body preview: ${body.substring(0, 100)}...`);

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('Webhook signature verified successfully');
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      
      // More detailed error response
      return new Response(JSON.stringify({ 
        error: `Webhook signature verification failed`,
        message: err.message,
        hint: 'Make sure the webhook secret matches the one in your Stripe dashboard',
        received_signature: signature.substring(0, 20) + '...',
        webhook_secret_length: webhookSecret.length,
        body_length: body.length
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Webhook event type: ${event.type}`);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('Checkout session completed. Details:', JSON.stringify({
        id: session.id,
        customer: session.customer,
        userId: session.client_reference_id,
        metadata: session.metadata,
        subscription: session.subscription
      }, null, 2));
      
      // Extract user ID from client_reference_id or metadata
      const userId = session.client_reference_id || session.metadata?.userId;
      const subscriptionId = session.subscription;
      const customerId = session.customer;
      const planId = session.metadata?.planId || 'athlete'; // Default to athlete if not specified
      
      console.log(`Processing checkout for user: ${userId}, plan: ${planId}, subscription: ${subscriptionId}`);

      if (!userId) {
        console.error('Missing user ID in checkout session (client_reference_id is null)');
        return new Response(JSON.stringify({ 
          error: 'Missing user ID',
          message: 'The checkout session does not include a client_reference_id or userId in metadata',
          session_data: {
            id: session.id,
            customer: session.customer,
            client_reference_id: session.client_reference_id,
            metadata: session.metadata,
          }
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // First check if user exists
      try {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', userId)
          .single();
        
        if (userError || !userData) {
          console.error('User not found in profiles table:', userError);
          return new Response(JSON.stringify({ 
            error: 'User not found',
            message: 'The user ID from the checkout session does not exist in the profiles table',
            user_id: userId
          }), { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (userCheckError) {
        console.error('Error checking user existence:', userCheckError);
      }

      // Update profile and subscription
      try {
        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            role: planId === 'organization' ? 'organization' : 'athlete',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          return new Response(JSON.stringify({ 
            error: 'Profile update error',
            message: profileError.message,
            details: profileError
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.log(`Updated user profile for ${userId} with role ${planId}`);
        }
        
        // Prepare subscription data
        const subscriptionData = {
          user_id: userId,
          stripe_subscription_id: subscriptionId || `one_time_${Date.now()}`,
          stripe_customer_id: customerId,
          plan_id: planId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Upsert subscription
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .upsert(subscriptionData);
        
        if (subscriptionError) {
          console.error('Error storing subscription data:', subscriptionError);
          
          // Check if the subscriptions table exists
          const { error: tablesError } = await supabase
            .rpc('get_tables')
            .select('*');
          
          if (tablesError) {
            console.error('Error checking tables:', tablesError);
          }
          
          return new Response(JSON.stringify({ 
            error: `Subscription storage error: ${subscriptionError.message}`,
            data: subscriptionData,
            details: subscriptionError
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.log(`Successfully stored subscription for user ${userId}`);
        }
      } catch (err) {
        console.error('Exception processing checkout session:', err);
        return new Response(JSON.stringify({ 
          error: `Exception processing checkout: ${err.message}`,
          stack: err.stack
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
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
          return new Response(JSON.stringify({ 
            error: 'Subscription update error',
            message: error.message,
            details: error
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.log(`Updated subscription status to ${subscription.status} for ID ${stripeSubscriptionId}`);
        }
      } catch (err) {
        console.error('Exception updating subscription:', err);
        return new Response(JSON.stringify({ 
          error: `Exception updating subscription: ${err.message}`,
          stack: err.stack
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
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
          return new Response(JSON.stringify({ 
            error: 'Subscription delete error',
            message: error.message,
            details: error
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.log(`Marked subscription ${stripeSubscriptionId} as inactive`);
        }
      } catch (err) {
        console.error('Exception deleting subscription:', err);
        return new Response(JSON.stringify({ 
          error: `Exception deleting subscription: ${err.message}`,
          stack: err.stack
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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
