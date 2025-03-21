
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const configStatus = {
      status: 'ok',
      stripeKeyConfigured: !!stripeSecretKey,
      webhookConfigured: !!webhookSecret,
      supabaseConfigured: !!(supabaseUrl && supabaseServiceKey),
      details: {}
    };

    // Check Stripe key configuration
    if (!stripeSecretKey) {
      configStatus.status = 'error';
      configStatus.details.stripeKey = 'Stripe secret key is not configured';
    } else {
      try {
        const stripe = new Stripe(stripeSecretKey, {
          httpClient: Stripe.createFetchHttpClient(),
          apiVersion: '2023-10-16',
        });
        
        // Test the Stripe API with a simple call
        const charges = await stripe.charges.list({ limit: 1 });
        configStatus.details.stripeConnection = 'Stripe API connection successful';
      } catch (error) {
        configStatus.status = 'error';
        configStatus.details.stripeConnection = `Stripe API connection failed: ${error.message}`;
      }
    }

    // Check webhook configuration
    if (!webhookSecret) {
      configStatus.status = 'error';
      configStatus.details.webhook = 'Webhook secret is not configured';
    } else {
      configStatus.details.webhook = 'Webhook secret is properly configured';
      
      // If Stripe is configured, check for webhooks
      if (stripeSecretKey) {
        try {
          const stripe = new Stripe(stripeSecretKey, {
            httpClient: Stripe.createFetchHttpClient(),
            apiVersion: '2023-10-16',
          });
          
          // List webhooks
          const webhooks = await stripe.webhookEndpoints.list();
          configStatus.details.webhookEndpoints = webhooks.data.length;
          
          // Check if we have any endpoints with the appropriate events
          const relevantEndpoints = webhooks.data.filter(endpoint => {
            const events = endpoint.enabled_events || [];
            return events.includes('checkout.session.completed') || 
                   events.includes('customer.subscription.updated') ||
                   events.includes('customer.subscription.deleted') ||
                   events.includes('*');
          });
          
          configStatus.details.relevantEndpoints = relevantEndpoints.length;
          
          if (relevantEndpoints.length === 0) {
            configStatus.status = 'warning';
            configStatus.details.webhookWarning = 'No webhook endpoints found with subscription events';
          }
        } catch (error) {
          configStatus.status = 'error';
          configStatus.details.webhookList = `Error listing webhooks: ${error.message}`;
        }
      }
    }

    // Check Supabase configuration
    if (!supabaseUrl || !supabaseServiceKey) {
      configStatus.status = 'error';
      configStatus.details.supabase = 'Supabase URL or service key is missing';
    } else {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Test Supabase connection
        const { count, error } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true });
          
        if (error) {
          configStatus.status = 'error';
          configStatus.details.supabaseConnection = `Supabase connection error: ${error.message}`;
        } else {
          configStatus.details.supabaseConnection = 'Supabase connection successful';
          configStatus.details.subscriptionsTable = `Subscriptions table has ${count} records`;
        }
      } catch (error) {
        configStatus.status = 'error';
        configStatus.details.supabaseConnection = `Supabase connection failed: ${error.message}`;
      }
    }

    return new Response(
      JSON.stringify(configStatus),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: error.message,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
