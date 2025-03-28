
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
    const athletePriceId = Deno.env.get('STRIPE_ATHLETE_PRICE_ID') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const projectRef = Deno.env.get('SUPABASE_PROJECT_REF') || '';

    // Determine if there's a request to fetch logs
    const { fetchLogs } = await req.json().catch(() => ({ fetchLogs: false }));
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check for required environment variables
    const stripeKeyConfigured = stripeSecretKey !== '';
    const webhookConfigured = webhookSecret !== '';
    const athletePriceConfigured = athletePriceId !== '';
    
    // Format information about the configuration
    const stripeInfo = stripeKeyConfigured ? 
      'Stripe API key is configured' : 
      'Stripe API key is missing';
      
    const webhookInfo = webhookConfigured ? 
      'Webhook secret is configured' : 
      'Webhook secret is missing';
      
    const athletePriceInfo = athletePriceConfigured ? 
      'Athlete price ID is configured' : 
      'Athlete price ID is missing';

    let webhookEndpoint = null;
    let webhookUrlFormatCorrect = false;
    
    // Check Stripe webhook configuration if Stripe is configured
    if (stripeKeyConfigured) {
      try {
        const stripe = new Stripe(stripeSecretKey, {
          httpClient: Stripe.createFetchHttpClient(),
          apiVersion: '2023-10-16',
        });

        // Get webhook endpoints from Stripe
        const endpoints = await stripe.webhookEndpoints.list();
        
        if (endpoints.data.length > 0) {
          webhookEndpoint = endpoints.data[0].url;
          
          // Check if webhook URL is in the correct format
          // It should be https://{projectRef}.functions.supabase.co/stripe-webhook
          // NOT https://{projectRef}.supabase.co/functions/v1/stripe-webhook (wrong)
          if (projectRef && webhookEndpoint) {
            const correctUrlFormat = `https://${projectRef}.functions.supabase.co/stripe-webhook`;
            webhookUrlFormatCorrect = webhookEndpoint === correctUrlFormat;
            
            if (!webhookUrlFormatCorrect) {
              console.warn(`Webhook URL is in incorrect format. Current: ${webhookEndpoint}, Should be: ${correctUrlFormat}`);
            }
          }
        }
      } catch (stripeError) {
        console.error('Error checking Stripe webhook:', stripeError);
      }
    }

    // Check database tables
    let database = { 
      tablesExist: false,
      error: null
    };
    
    try {
      // Try to query from profiles table - it should always exist
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('count(*)')
        .limit(1);
        
      if (profilesError) {
        database.error = `Error querying profiles: ${profilesError.message}`;
      }
      
      // Try to access subscriptions table
      const { error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('count(*)')
        .limit(1);
        
      // Tables exist if there are no errors
      database.tablesExist = !profilesError && !subscriptionsError;
      
      if (subscriptionsError && subscriptionsError.code === '42P01') {
        database.error = 'Subscriptions table does not exist yet';
      } else if (subscriptionsError) {
        database.error = `Error querying subscriptions: ${subscriptionsError.message}`;
      }
    } catch (dbError) {
      database.error = `Database error: ${dbError.message}`;
    }
    
    // Get webhook logs if requested
    let logs = [];
    if (fetchLogs) {
      try {
        // This would be a placeholder for actual log retrieval
        // In a real implementation, you might query a logs table or use a logging service
        logs = [
          {
            timestamp: new Date().toISOString(),
            message: "Log fetching not implemented in this version",
            level: "info"
          }
        ];
      } catch (logError) {
        console.error('Error fetching logs:', logError);
      }
    }

    // Prepare response
    const response = {
      stripeKeyConfigured,
      webhookConfigured,
      athletePriceConfigured,
      webhookUrlFormatCorrect: webhookUrlFormatCorrect,
      stripeInfo,
      webhookInfo,
      athletePriceInfo,
      webhookEndpoint,
      database,
      environmentVariables: {
        STRIPE_SECRET_KEY: stripeSecretKey ? '✓ Configured' : '✗ Missing',
        STRIPE_WEBHOOK_SECRET: webhookSecret ? '✓ Configured' : '✗ Missing',
        STRIPE_ATHLETE_PRICE_ID: athletePriceId ? '✓ Configured' : '✗ Missing',
        SUPABASE_URL: supabaseUrl ? '✓ Configured' : '✗ Missing',
        SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? '✓ Configured' : '✗ Missing',
        SUPABASE_PROJECT_REF: projectRef ? '✓ Configured' : '✗ Missing',
      },
      logs: fetchLogs ? logs : undefined
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-webhook-config function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
