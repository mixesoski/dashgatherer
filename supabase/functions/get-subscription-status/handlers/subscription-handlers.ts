
import { corsHeaders } from "../utils/cors.ts";
import { log } from "../utils/logger.ts";
import { fetchSubscriptionFromStripe } from "../services/stripe-service.ts";
import { updateSubscriptionStatus } from "../services/database-service.ts";

// Handle active subscription
export function handleActiveSubscription(subscriptionData: any, userRole: string) {
  log.debug(`Subscription data: ${JSON.stringify(subscriptionData)}`);
  
  return async () => {
    try {
      // Fetch the latest subscription status from Stripe
      const { subscription, error } = await fetchSubscriptionFromStripe(
        subscriptionData.stripe_subscription_id
      );
      
      if (error) {
        // If we can't reach Stripe, use the local data
        return new Response(
          JSON.stringify({
            active: subscriptionData.status === 'active' || subscriptionData.status === 'trialing',
            plan: subscriptionData.plan_id,
            status: subscriptionData.status,
            role: userRole,
            trialEnd: null,
            cancelAt: null,
            renewsAt: null,
            stripeSubscriptionId: subscriptionData.stripe_subscription_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Update our local database if the status has changed
      if (subscription.status !== subscriptionData.status) {
        log.info(`Updating subscription status from ${subscriptionData.status} to ${subscription.status}`);
        await updateSubscriptionStatus(subscriptionData.id, subscription.status);
      }

      return new Response(
        JSON.stringify({
          active: subscription.status === 'active' || subscription.status === 'trialing',
          plan: subscriptionData.plan_id,
          status: subscription.status,
          role: userRole,
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
          renewsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          stripeSubscriptionId: subscriptionData.stripe_subscription_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      log.error(`Error in handleActiveSubscription: ${error.message}`);
      throw error;
    }
  };
}

// Handle pending subscription
export function handlePendingSubscription(pendingSubscriptionData: any, userRole: string) {
  log.info(`Found pending subscription for user ${pendingSubscriptionData.user_id}`);
  
  return async () => {
    // Special handling for subscriptions that should be active but are still marked pending
    if (pendingSubscriptionData.stripe_subscription_id && 
        !pendingSubscriptionData.stripe_subscription_id.startsWith('pending_')) {
      
      try {
        // Try to check the subscription status directly with Stripe
        const { subscription, error } = await fetchSubscriptionFromStripe(
          pendingSubscriptionData.stripe_subscription_id
        );
        
        if (!error && (subscription.status === 'active' || subscription.status === 'trialing')) {
          // Update the subscription to active since we confirmed it with Stripe
          const updated = await updateSubscriptionStatus(pendingSubscriptionData.id, subscription.status);
          
          if (!updated) {
            log.error(`Error updating pending subscription to active`);
          } else {
            log.info(`Successfully updated subscription to ${subscription.status} from pending`);
            
            return new Response(
              JSON.stringify({
                active: true,
                plan: pendingSubscriptionData.plan_id,
                status: subscription.status,
                role: userRole,
                trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
                renewsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
                stripeSubscriptionId: pendingSubscriptionData.stripe_subscription_id
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (error) {
        // If we can't reach Stripe or the subscription doesn't exist, continue with the pending status
        log.error(`Error retrieving Stripe subscription: ${error.message}`);
      }
    }
    
    return new Response(
      JSON.stringify({
        active: false,
        plan: pendingSubscriptionData.plan_id,
        status: 'pending',
        role: userRole,
        trialEnd: null,
        cancelAt: null,
        renewsAt: null,
        pendingCheckout: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  };
}

// Handle coach role (which gets premium access)
export function handleCoachRole() {
  return (userId: string) => {
    log.info(`User ${userId} has coach role with premium access`);
    return new Response(
      JSON.stringify({
        active: true,
        plan: 'coach',
        status: 'active',
        role: 'coach',
        trialEnd: null,
        cancelAt: null,
        renewsAt: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  };
}

// Handle no subscription
export function handleNoSubscription(userRole: string) {
  return (userId: string) => {
    log.info(`No subscription found for user ${userId}`);
    return new Response(
      JSON.stringify({
        active: false,
        plan: null,
        status: 'no_subscription',
        role: userRole,
        trialEnd: null,
        cancelAt: null,
        renewsAt: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  };
}
