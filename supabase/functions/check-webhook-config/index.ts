
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
  
  let databaseStatus = {
    tablesExist: false,
    subscriptionsTableExists: false,
    profilesTableExists: false,
    error: null,
    details: null
  };

  // Check database tables if we have Supabase credentials
  if (supabaseDatabaseConfigured) {
    try {
      // Initialize Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Check if subscriptions table exists
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('count(*)', { count: 'exact', head: true });
      
      if (!subscriptionsError) {
        databaseStatus.subscriptionsTableExists = true;
      }
      
      // Check if profiles table exists
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('count(*)', { count: 'exact', head: true });
      
      if (!profilesError) {
        databaseStatus.profilesTableExists = true;
      }
      
      databaseStatus.tablesExist = databaseStatus.subscriptionsTableExists && 
                                  databaseStatus.profilesTableExists;
    } catch (error) {
      console.error('Error checking database tables:', error);
      databaseStatus.error = error.message;
      databaseStatus.details = error;
    }
  }
  
  // Create configuration status object
  const config = {
    webhookConfigured,
    stripeKeyConfigured,
    athletePriceConfigured,
    supabaseDatabaseConfigured,
    database: databaseStatus,
    status: webhookConfigured && stripeKeyConfigured && athletePriceConfigured && 
            supabaseDatabaseConfigured && databaseStatus.tablesExist
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
      database: "Make sure both the 'subscriptions' and 'profiles' tables exist in your database"
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
