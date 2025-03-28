
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { config } from "../config/config.ts";
import { log } from "../utils/logger.ts";

// Initialize Stripe client
export const stripe = new Stripe(config.stripe.secretKey, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: config.stripe.apiVersion,
});

// Fetch subscription from Stripe
export async function fetchSubscriptionFromStripe(subscriptionId: string) {
  try {
    log.debug(`Fetching subscription from Stripe: ${subscriptionId}`);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    log.debug(`Stripe subscription data: ${JSON.stringify(subscription)}`);
    return { subscription, error: null };
  } catch (error) {
    log.error(`Error retrieving Stripe subscription: ${error.message}`);
    return { subscription: null, error };
  }
}
