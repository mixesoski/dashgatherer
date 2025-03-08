
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe signature', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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
        return new Response('Missing user ID', { status: 400 });
      }

      if (!planId) {
        console.error('Missing planId in session metadata');
        return new Response('Missing plan ID', { status: 400 });
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
          return new Response(`Subscription storage error: ${subscriptionError.message}`, { status: 500 });
        } else {
          console.log(`Successfully stored subscription for user ${userId}`);
        }
      } catch (subscriptionInsertError) {
        console.error('Exception storing subscription:', subscriptionInsertError);
        return new Response(`Subscription exception: ${subscriptionInsertError.message}`, { status: 500 });
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

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
