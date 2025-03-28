
import { log } from "../utils/logger.ts";
import { corsHeaders } from "../utils/cors.ts";
import { 
  updateProfileRole, 
  storeSubscriptionData, 
  getPendingSubscription,
  updatePendingSubscription,
  updateSubscriptionStatus,
  getSubscriptionByStripeId,
  verifySubscriptionCreated
} from "../services/supabase-service.ts";

// Handle checkout.session.completed event
export async function handleCheckoutCompleted(session: any): Promise<Response> {
  log.debug('Session data:', JSON.stringify(session));
  
  // Get user ID in multiple ways to ensure we capture it
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
  const { data: pendingSubscription, error: pendingError } = await getPendingSubscription(userId);
  
  // If we found a pending subscription, update it instead of creating a new one
  if (pendingSubscription) {
    log.info(`Found pending subscription for user ${userId}, updating it to active`);
    
    const updated = await updatePendingSubscription(
      subscriptionId,
      pendingSubscription.id,
      session.customer
    );
    
    if (!updated) {
      return new Response(JSON.stringify({ error: 'Failed to update pending subscription' }), { status: 500 });
    }
    
    log.info(`Successfully updated pending subscription to active for user ${userId}`);
  } else {
    // Complete transactions in parallel for better performance
    const promises = [];

    // 1. Update profile with role
    promises.push(updateProfileRole(userId, planId));

    // 2. Store subscription data
    promises.push(storeSubscriptionData(
      userId, 
      subscriptionId, 
      session.customer, 
      planId, 
      'active'
    ));

    // Wait for all operations to complete
    const results = await Promise.all(promises);
    log.debug('Database update results:', JSON.stringify(results));
    
    // Check for errors
    if (results.includes(false)) {
      log.error('Errors during database updates');
      return new Response(JSON.stringify({ error: 'Database update failures' }), { status: 500 });
    }
  }
  
  // Double check that subscription was actually created
  await verifySubscriptionCreated(userId);
  
  log.info('Successfully processed checkout.session.completed');
  
  return new Response(JSON.stringify({ received: true }), { 
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handle customer.subscription.updated event
export async function handleSubscriptionUpdated(subscription: any): Promise<Response> {
  const stripeSubscriptionId = subscription.id;
  log.debug(`Subscription ${stripeSubscriptionId} updated to status: ${subscription.status}`);

  // Fetch user associated with this subscription
  const { data, error } = await getSubscriptionByStripeId(stripeSubscriptionId);

  if (error || !data) {
    log.error('Error fetching subscription:', error);
  } else {
    log.debug(`Updating subscription status for user ${data.user_id}`);
    await updateSubscriptionStatus(stripeSubscriptionId, subscription.status);
  }

  return new Response(JSON.stringify({ received: true }), { 
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handle customer.subscription.deleted event
export async function handleSubscriptionDeleted(subscription: any): Promise<Response> {
  const stripeSubscriptionId = subscription.id;
  log.debug(`Subscription ${stripeSubscriptionId} deleted`);

  // Update subscription to inactive
  await updateSubscriptionStatus(stripeSubscriptionId, 'inactive');
  
  return new Response(JSON.stringify({ received: true }), { 
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Fallback handler for other event types
export function handleOtherEventType(eventType: string): Response {
  log.info(`Received event type: ${eventType} (no specific handler)`);
  
  return new Response(JSON.stringify({ received: true, eventType }), { 
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
