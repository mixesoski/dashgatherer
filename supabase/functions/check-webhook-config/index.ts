
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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const athletePriceId = Deno.env.get('STRIPE_ATHLETE_PRICE_ID');

    const configStatus = {
      status: 'ok',
      stripeKeyConfigured: !!stripeSecretKey,
      webhookConfigured: !!webhookSecret,
      athletePriceConfigured: !!athletePriceId,
      environmentVariables: {
        'STRIPE_SECRET_KEY': stripeSecretKey ? 
          `✓ Key exists${stripeSecretKey.startsWith('sk_test_') ? ' (Test Mode)' : ' (Live Mode)'}` : 
          '✗ Missing',
        'STRIPE_WEBHOOK_SECRET': webhookSecret ? 
          `✓ Secret exists${webhookSecret.startsWith('whsec_') ? '' : ' (Invalid format)'}` : 
          '✗ Missing',
        'STRIPE_ATHLETE_PRICE_ID': athletePriceId ? 
          `✓ Price ID exists${athletePriceId.startsWith('price_') ? '' : ' (Invalid format)'}` : 
          '✗ Missing'
      },
      details: {}
    };

    // Check Stripe key configuration
    if (!stripeSecretKey) {
      configStatus.status = 'error';
      configStatus.stripeInfo = 'Stripe secret key is not configured';
    } else if (!stripeSecretKey.startsWith('sk_test_')) {
      configStatus.stripeInfo = 'Warning: Not using a test mode key (sk_test_)';
    } else {
      try {
        const stripe = new Stripe(stripeSecretKey, {
          httpClient: Stripe.createFetchHttpClient(),
          apiVersion: '2023-10-16',
        });
        
        // Test the Stripe API with a simple call
        await stripe.customers.list({ limit: 1 });
        configStatus.stripeInfo = 'Stripe API TEST mode connection successful';
      } catch (error) {
        configStatus.status = 'error';
        configStatus.stripeInfo = `Stripe API connection failed: ${error.message}`;
      }
    }

    // Check webhook configuration
    if (!webhookSecret) {
      configStatus.status = 'error';
      configStatus.webhookInfo = 'Webhook secret is not configured';
    } else if (!webhookSecret.startsWith('whsec_')) {
      configStatus.webhookInfo = 'Warning: Webhook secret does not start with whsec_';
    } else {
      configStatus.webhookInfo = 'Webhook secret is properly formatted';
    }

    // Check price ID configuration
    if (!athletePriceId) {
      configStatus.status = 'error';
      configStatus.athletePriceInfo = 'Athlete price ID is not configured';
    } else if (!athletePriceId.startsWith('price_')) {
      configStatus.athletePriceInfo = 'Warning: Price ID does not start with price_';
    } else {
      configStatus.athletePriceInfo = 'Price ID is properly formatted';
    }

    // Check database setup
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Check if subscriptions table exists
        const { count, error } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true });
          
        if (error) {
          configStatus.database = {
            tablesExist: false,
            error: error.message
          };
        } else {
          configStatus.database = {
            tablesExist: true,
            subscriptionCount: count
          };
        }
      } else {
        configStatus.database = {
          tablesExist: false,
          error: 'Supabase credentials not configured'
        };
      }
    } catch (dbError) {
      configStatus.database = {
        tablesExist: false,
        error: dbError.message
      };
    }

    return new Response(
      JSON.stringify(configStatus),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error checking webhook config:', error);
    
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
