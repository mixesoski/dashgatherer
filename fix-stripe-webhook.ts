
// This is a copy of the changes made to the stripe-webhook edge function
// for testing purposes
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
    log.error('Missing stripe signature in request');
    return new Response('Missing stripe signature', { status: 400 });
  }

  try {
    const body = await req.text();
    log.debug('Webhook body received:', body.substring(0, 200) + '...');
    
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    log.info(`Webhook received: ${event.type}`);

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

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    log.error(`Webhook Error: ${err.message}`, err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
}); 
