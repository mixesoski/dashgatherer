
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
    
    // Log request headers and method for debugging
    console.log(`Request method: ${req.method}`);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(JSON.stringify({ 
        error: 'Missing stripe signature',
        message: 'The webhook request is missing the stripe-signature header required for verification' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!webhookSecret) {
      console.error('Webhook secret is not configured in environment variables');
      return new Response(JSON.stringify({ 
        error: 'Webhook secret not configured',
        message: 'The STRIPE_WEBHOOK_SECRET environment variable is not set' 
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the request body as text for Stripe signature verification
    const body = await req.text();
    
    // Log the first part of the body (truncated for security)
    console.log(`Request body (truncated): ${body.substring(0, 200)}...`);

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('Webhook signature verified successfully');
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(JSON.stringify({ 
        error: `Webhook signature verification failed`,
        message: err.message,
        hint: 'Make sure the webhook secret matches the one in your Stripe dashboard' 
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
      }));
      
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
          message: 'The checkout session does not include a client_reference_id or userId in metadata' 
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get existing profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      // Update user profile
      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            role: planId === 'organization' ? 'organization' : 'athlete',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        } else {
          console.log(`Updated user profile for ${userId} with role ${planId}`);
        }
      } catch (profileUpdateError) {
        console.error('Exception updating profile:', profileUpdateError);
      }

      // Store subscription data
      try {
        const subscriptionData = {
          user_id: userId,
          stripe_subscription_id: subscriptionId || `one_time_${Date.now()}`,
          stripe_customer_id: customerId,
          plan_id: planId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log('Inserting subscription data:', subscriptionData);
        
        // Check if subscription already exists for this user and update it
        const { data: existingSubscription, error: checkError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .single();
          
        let subscriptionResult;
        
        if (existingSubscription) {
          // Update existing subscription
          subscriptionResult = await supabase
            .from('subscriptions')
            .update({
              stripe_subscription_id: subscriptionData.stripe_subscription_id,
              stripe_customer_id: subscriptionData.stripe_customer_id,
              plan_id: subscriptionData.plan_id,
              status: subscriptionData.status,
              updated_at: subscriptionData.updated_at
            })
            .eq('user_id', userId);
          console.log('Updated existing subscription');
        } else {
          // Insert new subscription
          subscriptionResult = await supabase
            .from('subscriptions')
            .insert(subscriptionData);
          console.log('Inserted new subscription');
        }
        
        if (subscriptionResult.error) {
          console.error('Error storing subscription data:', subscriptionResult.error);
          return new Response(JSON.stringify({ error: `Subscription storage error: ${subscriptionResult.error.message}` }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.log(`Successfully stored subscription for user ${userId}`);
        }
      } catch (subscriptionInsertError) {
        console.error('Exception storing subscription:', subscriptionInsertError);
        return new Response(JSON.stringify({ error: `Subscription exception: ${subscriptionInsertError.message}` }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const stripeSubscriptionId = subscription.id;
      console.log(`Subscription updated: ${stripeSubscriptionId}, status: ${subscription.status}`);

      // Fetch user associated with this subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .single();

      if (error) {
        console.error('Error fetching subscription:', error);
      } else if (data) {
        // Update subscription status
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', stripeSubscriptionId);
          
        if (updateError) {
          console.error('Error updating subscription status:', updateError);
        } else {
          console.log(`Updated subscription status to ${subscription.status} for ID ${stripeSubscriptionId}`);
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const stripeSubscriptionId = subscription.id;
      console.log(`Subscription deleted: ${stripeSubscriptionId}`);

      // Update subscription to inactive
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', stripeSubscriptionId);
        
      if (error) {
        console.error('Error updating deleted subscription:', error);
      } else {
        console.log(`Marked subscription ${stripeSubscriptionId} as inactive`);
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
