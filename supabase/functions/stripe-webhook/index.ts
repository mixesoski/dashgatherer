
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
      const userId = session.client_reference_id;
      const subscriptionId = session.subscription;
      const planId = session.metadata?.planId;

      if (userId && subscriptionId && planId) {
        // Update user role
        await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: planId === 'organization' ? 'organization' : 'athlete' });

        // Store subscription data
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: session.customer,
            plan_id: planId,
            status: 'active',
            created_at: new Date().toISOString()
          });
      }
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const stripeSubscriptionId = subscription.id;

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
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', stripeSubscriptionId);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const stripeSubscriptionId = subscription.id;

      // Update subscription to inactive
      await supabase
        .from('subscriptions')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', stripeSubscriptionId);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
