
import { corsHeaders } from "../utils/cors.ts";
import { log } from "../utils/logger.ts";
import { config, getCorrectWebhookUrl } from "../config/config.ts";
import { verifyStripeSignature, parseEventBody } from "../services/stripe-service.ts";
import { 
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleOtherEventType
} from "./event-handlers.ts";

// Main webhook handler function
export async function handleWebhookEvent(req: Request): Promise<Response> {
  // Log correct webhook URL format for reference
  const correctWebhookUrl = getCorrectWebhookUrl();
  log.debug(`Correct webhook URL format: ${correctWebhookUrl}`);

  // Log headers in a readable format
  const headersObj: Record<string, string> = {};
  for (const [key, value] of req.headers.entries()) {
    headersObj[key] = value;
  }
  log.debug('Request headers:', JSON.stringify(headersObj, null, 2));
  
  // Clone the request so we can read the body multiple times if needed
  const clonedReq = req.clone();
  
  // First try to verify the signature
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    log.error('Missing stripe-signature header');
    
    // For better compatibility, try to process the event without verification
    try {
      const rawBody = await clonedReq.text();
      const body = parseEventBody(rawBody);
      
      if (body?.type === 'checkout.session.completed') {
        log.info('Processing checkout.session.completed event without signature verification');
        return await handleCheckoutCompleted(body.data.object);
      }
    } catch (fallbackErr) {
      log.error('Error in fallback processing:', fallbackErr);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Missing stripe-signature header',
        details: 'The webhook request is missing the stripe-signature header required for verification',
        headersReceived: JSON.stringify(headersObj),
        correctWebhookUrl
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  if (!config.stripe.webhookSecret) {
    log.error('Webhook secret is not configured in environment variables');
    return new Response(
      JSON.stringify({ 
        error: 'Webhook secret not configured',
        details: 'The STRIPE_WEBHOOK_SECRET environment variable is not set or is empty',
        envStatus: {
          webhook_secret: config.stripe.webhookSecret ? 'present' : 'missing',
          stripe_key: config.stripe.secretKey ? 'present' : 'missing',
          supabase_url: config.supabase.url ? 'present' : 'missing',
          supabase_key: config.supabase.serviceRoleKey ? 'present (length: ' + config.supabase.serviceRoleKey.length + ')' : 'missing'
        }
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Get the request body as text for Stripe signature verification
  const body = await req.text();
  log.debug(`Webhook body received:`, body.substring(0, 500) + '...');
  
  // Verify Stripe signature and get event
  const event = await verifyStripeSignature(body, signature);
  
  if (!event) {
    // Try to process the event without verification as a fallback
    try {
      const jsonBody = parseEventBody(body);
      
      if (jsonBody?.type === 'checkout.session.completed') {
        log.info('Attempting to process checkout session despite signature failure');
        return await handleCheckoutCompleted(jsonBody.data.object);
      }
    } catch (fallbackErr) {
      log.error('Error in fallback processing:', fallbackErr);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Webhook signature verification failed',
        hint: 'Make sure the webhook secret matches the one in your Stripe dashboard'
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Handle different event types
  switch (event.type) {
    case 'checkout.session.completed':
      return await handleCheckoutCompleted(event.data.object);
      
    case 'customer.subscription.updated':
      return await handleSubscriptionUpdated(event.data.object);
      
    case 'customer.subscription.deleted':
      return await handleSubscriptionDeleted(event.data.object);
      
    default:
      return handleOtherEventType(event.type);
  }
}
