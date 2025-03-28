
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { log } from "./utils/logger.ts";
import { corsHeaders, handleCorsPreflightRequest } from "./utils/cors.ts";
import { getCorrectWebhookUrl } from "./config/config.ts";
import { 
  getUserProfile, 
  getActiveSubscription, 
  getPendingSubscription 
} from "./services/database-service.ts";
import { 
  handleActiveSubscription, 
  handlePendingSubscription, 
  handleCoachRole, 
  handleNoSubscription 
} from "./handlers/subscription-handlers.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    // Parse request body
    const { userId } = await req.json();
    log.info(`Getting subscription status for user: ${userId}`);

    // Log correct webhook URL format
    const correctWebhookUrl = getCorrectWebhookUrl();
    if (correctWebhookUrl) {
      log.debug(`Correct webhook URL format: ${correctWebhookUrl}`);
    }

    // Verify userId is provided
    if (!userId) {
      log.error('No user ID provided');
      throw new Error('User ID is required');
    }

    // Check if the user is in the profiles table and get their role
    const { data: profileData, error: profileError } = await getUserProfile(userId);

    // Get user's role from profile data or default to 'athlete'
    const userRole = profileData?.role || 'athlete';
    log.debug(`User role from profiles: ${userRole}`);

    // Check if user has an active subscription
    const { data: subscriptionData, error: subscriptionError } = await getActiveSubscription(userId);

    if (subscriptionError) {
      // If the subscriptions table doesn't exist yet, return a default response
      if (subscriptionError.code === '42P01') { // Table doesn't exist
        log.info('Subscriptions table does not exist yet');
        return handleNoSubscription(userRole)(userId);
      }
      
      throw subscriptionError;
    }

    // Check for pending subscriptions
    if (!subscriptionData) {
      const { data: pendingSubscriptionData, error: pendingError } = await getPendingSubscription(userId);
      
      if (pendingSubscriptionData && !pendingError) {
        return await handlePendingSubscription(pendingSubscriptionData, userRole)();
      }
    }

    // If we have a subscription in the database and it's connected to Stripe
    if (subscriptionData?.stripe_subscription_id) {
      return await handleActiveSubscription(subscriptionData, userRole)();
    }

    // Check if user has coach role (which gets premium access)
    if (userRole === 'coach') {
      return handleCoachRole()(userId);
    }

    // Default response for users without a subscription
    return handleNoSubscription(userRole)(userId);
    
  } catch (error) {
    log.error(`Error getting subscription status: ${error.message}`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
