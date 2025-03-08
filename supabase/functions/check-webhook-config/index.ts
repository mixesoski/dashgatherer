
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get environment variables
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const athletePriceId = Deno.env.get('STRIPE_ATHLETE_PRICE_ID') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  // Validate environment variables
  const webhookConfigured = webhookSecret.length > 0;
  const stripeKeyConfigured = stripeKey.length > 0;
  const athletePriceConfigured = athletePriceId.length > 0;
  const supabaseDatabaseConfigured = supabaseUrl.length > 0 && supabaseKey.length > 0;
  
  // Create configuration status object
  const config = {
    webhookConfigured,
    stripeKeyConfigured,
    athletePriceConfigured,
    supabaseDatabaseConfigured,
    status: webhookConfigured && stripeKeyConfigured && athletePriceConfigured && supabaseDatabaseConfigured 
      ? 'ready' 
      : 'missing_configuration',
    timestamp: new Date().toISOString(),
    message: "Configuration check completed",
    
    // Detailed information about the configuration
    webhookInfo: webhookConfigured 
      ? "Webhook secret is configured. Make sure it matches the webhook signing secret in your Stripe dashboard."
      : "Webhook secret is missing. Copy it from your Stripe Dashboard > Developers > Webhooks > Signing Secret.",
    
    stripeInfo: stripeKeyConfigured
      ? "Stripe API key is configured"
      : "Stripe API key is missing. Get it from your Stripe Dashboard > Developers > API keys.",
    
    setupInstructions: {
      webhook: "Ensure Stripe webhook is configured to send events to your Supabase Edge Function URL with these events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted",
      headers: "The webhook should send the stripe-signature header with each request",
      secret: "The webhook secret must match between Stripe Dashboard and your environment variables",
      testing: "Use Stripe CLI to test webhook delivery: stripe listen --forward-to your-webhook-url",
    },
    
    environmentVariables: {
      STRIPE_WEBHOOK_SECRET: webhookSecret ? "✓ Configured" : "✗ Missing",
      STRIPE_SECRET_KEY: stripeKey ? "✓ Configured" : "✗ Missing",
      STRIPE_ATHLETE_PRICE_ID: athletePriceId ? "✓ Configured" : "✗ Missing",
      SUPABASE_URL: supabaseUrl ? "✓ Configured" : "✗ Missing",
      SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? "✓ Configured" : "✗ Missing"
    }
  };

  // Log the configuration status
  console.log("Stripe configuration check:", config.status);
  
  // Return the configuration status
  return new Response(
    JSON.stringify(config),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
