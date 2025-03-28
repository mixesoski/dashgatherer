
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { config } from "../config/config.ts";
import { log } from "../utils/logger.ts";

// Initialize Stripe client
export const stripe = new Stripe(config.stripe.secretKey, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: config.stripe.apiVersion,
});

// Verify Stripe signature and construct event
export async function verifyStripeSignature(
  body: string, 
  signature: string
): Promise<Stripe.Event | null> {
  try {
    if (!config.stripe.webhookSecret) {
      log.error('Webhook secret is not configured');
      return null;
    }
    
    const event = stripe.webhooks.constructEvent(
      body, 
      signature, 
      config.stripe.webhookSecret
    );
    
    log.info(`Webhook signature verified successfully`);
    log.info(`Webhook event type: ${event.type}`);
    
    return event;
  } catch (err) {
    log.error(`Webhook signature verification failed: ${err.message}`);
    return null;
  }
}

// Parse request body as JSON
export function parseEventBody(body: string): any {
  try {
    return JSON.parse(body);
  } catch (err) {
    log.error(`Error parsing webhook body: ${err.message}`);
    return null;
  }
}
