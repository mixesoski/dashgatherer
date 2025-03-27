
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

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
    const projectId = Deno.env.get('SUPABASE_PROJECT_REF') || '';
    const athletePriceId = Deno.env.get('STRIPE_ATHLETE_PRICE_ID') || '';
    
    // Check that the necessary environment variables are configured
    const stripeKeyConfigured = stripeKey !== '';
    const webhookSecretConfigured = webhookSecret !== '';
    const projectIdConfigured = projectId !== '';
    const athletePriceConfigured = athletePriceId !== '';
    
    // Construct the correct webhook URL - FIXED FORMAT
    let webhookUrl = null;
    if (projectIdConfigured) {
      webhookUrl = `https://${projectId}.functions.supabase.co/stripe-webhook`;
    }
    
    // Check if the current webhook endpoint in Stripe is correctly formatted
    let webhookUrlFormatCorrect = false;
    let webhookEndpoint = null;
    
    if (stripeKeyConfigured) {
      try {
        // Fetch webhook endpoint from Stripe API if possible
        const headers = {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/json'
        };
        
        const response = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
          method: 'GET',
          headers: headers
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            // Find the first webhook endpoint that looks like it's for our Supabase function
            const webhooks = data.data.filter((webhook: any) => 
              webhook.url && webhook.url.includes('supabase') && 
              webhook.url.includes(projectId)
            );
            
            if (webhooks.length > 0) {
              webhookEndpoint = webhooks[0].url;
              // Check if it's using the correct format (.functions.supabase.co)
              // And ensure it doesn't have /v1/ in the URL
              webhookUrlFormatCorrect = webhookEndpoint.includes('.functions.supabase.co') && 
                                       !webhookEndpoint.includes('/functions/v1/') &&
                                       !webhookEndpoint.includes('/v1/');
            }
          }
        }
      } catch (error) {
        console.error('Error checking Stripe webhook endpoints:', error);
      }
    }
    
    // Check database tables
    let database = {
      tablesExist: false,
      error: null
    };
    
    try {
      // Create a supabase client with the service role key
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.7.1');
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Check if subscriptions table exists
        const { error } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true });
        database.tablesExist = !error;
        database.error = error ? error.message : null;
      }
    } catch (dbError) {
      database.error = dbError.message;
    }
    
    // Build detailed info messages
    const stripeInfo = stripeKeyConfigured ? 
      'Stripe API key is properly configured.' : 
      'Stripe API key is missing. Set STRIPE_SECRET_KEY in Edge Function secrets.';
      
    const webhookInfo = webhookSecretConfigured ? 
      'Webhook secret is properly configured.' : 
      'Webhook secret is missing. Set STRIPE_WEBHOOK_SECRET in Edge Function secrets.';
      
    const athletePriceInfo = athletePriceConfigured ? 
      'Athlete price ID is properly configured.' : 
      'Athlete price ID is missing. Set STRIPE_ATHLETE_PRICE_ID in Edge Function secrets.';
    
    // Create a structured response about environment variables
    const environmentVariables = {
      'STRIPE_SECRET_KEY': stripeKeyConfigured ? '✓ configured' : '✗ missing',
      'STRIPE_WEBHOOK_SECRET': webhookSecretConfigured ? '✓ configured' : '✗ missing',
      'STRIPE_ATHLETE_PRICE_ID': athletePriceConfigured ? '✓ configured' : '✗ missing',
      'SUPABASE_PROJECT_REF': projectIdConfigured ? '✓ configured' : '✗ missing',
      'SUPABASE_URL': Deno.env.get('SUPABASE_URL') ? '✓ configured' : '✗ missing',
      'SUPABASE_SERVICE_ROLE_KEY': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? '✓ configured' : '✗ missing'
    };
    
    // Return configuration status
    return new Response(
      JSON.stringify({ 
        status: 'success',
        stripeKeyConfigured,
        webhookSecretConfigured,
        athletePriceConfigured,
        projectIdConfigured,
        webhookConfigured: stripeKeyConfigured && webhookSecretConfigured && projectIdConfigured,
        webhookUrl, // Correct URL format
        webhookEndpoint, // Current URL in Stripe (if available)
        webhookUrlFormatCorrect,
        stripeInfo,
        webhookInfo,
        athletePriceInfo,
        database,
        environmentVariables
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-webhook-config function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        status: 'error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
