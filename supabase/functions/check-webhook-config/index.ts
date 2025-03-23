
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Retrieve environment variables
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const webhookSecretKey = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
    const athletePriceId = Deno.env.get('STRIPE_ATHLETE_PRICE_ID') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    console.log('Checking Stripe configuration...');
    
    // Prepare response data
    const configurationData: any = {
      webhookConfigured: webhookSecretKey.length > 0,
      webhookInfo: webhookSecretKey 
        ? 'Webhook secret is configured' 
        : 'Webhook secret is not configured',
      
      stripeKeyConfigured: stripeSecretKey.length > 0,
      stripeInfo: stripeSecretKey
        ? `Stripe API key is configured (${stripeSecretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE'} mode)`
        : 'Stripe API key is not configured',
      
      athletePriceConfigured: athletePriceId.length > 0,
      athletePriceInfo: athletePriceId
        ? `Athlete price ID is configured: ${athletePriceId.substring(0, 5)}...`
        : 'Athlete price ID is not configured',
        
      environmentVariables: {
        'STRIPE_SECRET_KEY': stripeSecretKey ? `${stripeSecretKey.substring(0, 8)}... ✓` : 'Missing ✗',
        'STRIPE_WEBHOOK_SECRET': webhookSecretKey ? `${webhookSecretKey.substring(0, 8)}... ✓` : 'Missing ✗',
        'STRIPE_ATHLETE_PRICE_ID': athletePriceId ? `${athletePriceId.substring(0, 8)}... ✓` : 'Missing ✗',
      }
    };

    // Try to connect to Stripe if we have an API key
    if (stripeSecretKey) {
      try {
        const stripe = new Stripe(stripeSecretKey, {
          httpClient: Stripe.createFetchHttpClient(),
          apiVersion: '2023-10-16',
        });
        
        // Verify we can connect to Stripe by making a simple request
        const account = await stripe.account.retrieve();
        configurationData.stripeConnectionVerified = true;
        configurationData.stripeAccount = {
          id: account.id,
          businessName: account.business_profile?.name || 'Not set',
          testMode: stripeSecretKey.startsWith('sk_test_')
        };
      } catch (stripeError) {
        console.error('Stripe connection error:', stripeError);
        configurationData.stripeConnectionVerified = false;
        configurationData.stripeConnectionError = stripeError.message;
      }
    }

    // Check database tables if we have Supabase credentials
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Check if subscriptions table exists
        const { data, error, count } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true });
          
        if (error) {
          configurationData.database = {
            tablesExist: false,
            error: error.message
          };
        } else {
          configurationData.database = {
            tablesExist: true,
            subscriptionCount: count
          };
        }
      } catch (dbError) {
        console.error('Database check error:', dbError);
        configurationData.database = {
          tablesExist: false,
          error: dbError.message
        };
      }
    }

    return new Response(
      JSON.stringify(configurationData),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error checking webhook configuration:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to check webhook configuration',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
