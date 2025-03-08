
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Webhook request received');
    
    const signature = req.headers.get('stripe-signature');
    
    // Log the headers for debugging
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(JSON.stringify({ error: 'Missing stripe signature' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!webhookSecret) {
      console.error('Webhook secret is not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the request body as text for Stripe signature verification
    const body = await req.text();
    
    // Log the first part of the body (truncated for security)
    console.log(`Request body (truncated): ${body.substring(0, 100)}...`);

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Webhook received: ${event.type}`);

    // Handle different event types
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('Checkout session completed:', JSON.stringify(session, null, 2));
      
      // Extract user ID and plan ID
      const userId = session.client_reference_id;
      const subscriptionId = session.subscription;
      const customerId = session.customer;
      const planId = session.metadata?.planId;

      console.log(`Processing checkout for user: ${userId}, plan: ${planId}, subscription: ${subscriptionId}`);

      if (!userId) {
        console.error('Missing client_reference_id (user ID) in checkout session');
        return new Response(JSON.stringify({ error: 'Missing user ID' }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!planId) {
        console.error('Missing planId in session metadata');
        return new Response(JSON.stringify({ error: 'Missing plan ID' }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update user profile
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            role: planId === 'organization' ? 'organization' : 'athlete',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (profileError) {
          console.error('Error updating user profile:', profileError);
        } else {
          console.log(`Updated user profile for user ${userId} with role ${planId}`);
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
        
        console.log('Inserting subscription:', subscriptionData);
        
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .upsert(subscriptionData);

        if (subscriptionError) {
          console.error('Error storing subscription data:', subscriptionError);
          return new Response(JSON.stringify({ error: `Subscription storage error: ${subscriptionError.message}` }), { 
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
    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
