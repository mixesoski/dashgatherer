
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const athletePriceId = Deno.env.get('STRIPE_ATHLETE_PRICE_ID');
    const projectId = supabaseUrl?.match(/https:\/\/(.*?)\.supabase/)?.[1] || '';

    // Optional request body parameters
    let reqBody = {};
    try {
      if (req.body) {
        reqBody = await req.json();
      }
    } catch (e) {
      // Ignore parsing errors
    }

    // Initialize Supabase client
    let supabase;
    let tablesExist = false;
    let databaseError = null;
    
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
      
      // Check if subscriptions table exists
      try {
        const { count, error } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true });
          
        tablesExist = !error;
      } catch (err) {
        databaseError = err.message;
      }
    }

    // Test Stripe connection
    let stripeConfigured = false;
    let priceConfigured = false;
    let stripe;
    
    if (stripeKey) {
      try {
        stripe = new Stripe(stripeKey, {
          httpClient: Stripe.createFetchHttpClient(),
          apiVersion: '2023-10-16',
        });
        
        // Test basic connection
        const account = await stripe.account.retrieve();
        stripeConfigured = !!account.id;
        
        // Verify the product price exists
        if (athletePriceId) {
          try {
            const price = await stripe.prices.retrieve(athletePriceId);
            priceConfigured = !!price.id;
          } catch {
            priceConfigured = false;
          }
        }
      } catch {
        stripeConfigured = false;
      }
    }

    // Generate webhook endpoint
    const webhookEndpoint = projectId ? 
      `https://${projectId}.functions.supabase.co/stripe-webhook` : 
      'Unknown (SUPABASE_URL not configured properly)';
    
    // Check for correct webhook URL format
    const webhookUrlFormatCorrect = webhookEndpoint.includes(projectId) && 
                                   !webhookEndpoint.includes('?') && 
                                   !webhookEndpoint.includes('key=');

    // Get logs if requested
    let logs = [];
    if (reqBody.fetchLogs) {
      try {
        logs = [
          { timestamp: new Date().toISOString(), message: "Log retrieval simulated (actual logs can only be viewed in Supabase dashboard)", level: "info" },
          { timestamp: new Date().toISOString(), message: `Using webhook endpoint: ${webhookEndpoint}`, level: "info" },
          { timestamp: new Date().toISOString(), message: "Verify Stripe Dashboard has the correct webhook URL configured", level: "info" }
        ];

        // If Stripe is configured, try to get recent webhook events
        if (stripeConfigured && stripe) {
          try {
            const events = await stripe.events.list({
              limit: 5,
              type: 'checkout.session.completed'
            });
            
            if (events && events.data.length > 0) {
              logs.push({ 
                timestamp: new Date().toISOString(), 
                message: `Found ${events.data.length} recent checkout.session.completed events in Stripe`, 
                level: "info" 
              });
              
              // Add most recent event
              const mostRecent = events.data[0];
              logs.push({ 
                timestamp: new Date(mostRecent.created * 1000).toISOString(), 
                message: `Most recent event: ${mostRecent.type} (ID: ${mostRecent.id})`, 
                level: "info" 
              });
            } else {
              logs.push({ 
                timestamp: new Date().toISOString(), 
                message: "No recent checkout.session.completed events found in Stripe", 
                level: "warning" 
              });
            }
          } catch (error) {
            logs.push({ 
              timestamp: new Date().toISOString(), 
              message: `Error fetching Stripe events: ${error.message}`, 
              level: "error" 
            });
          }
        }
      } catch (error) {
        logs = [{ timestamp: new Date().toISOString(), message: `Error fetching logs: ${error.message}`, level: "error" }];
      }
    }

    // Prepare response
    const response = {
      status: 'success',
      webhookConfigured: !!webhookSecret,
      stripeKeyConfigured: stripeConfigured,
      athletePriceConfigured: priceConfigured,
      webhookEndpoint,
      webhookUrlFormatCorrect,
      database: {
        tablesExist,
        error: databaseError
      },
      webhookInfo: webhookSecret 
        ? 'Webhook secret is configured' 
        : 'Webhook secret is not configured.',
      stripeInfo: stripeConfigured 
        ? 'Stripe connection successful' 
        : 'Stripe connection failed or not configured.',
      athletePriceInfo: priceConfigured 
        ? 'Athlete price ID found' 
        : athletePriceId ? 'Athlete price ID not found in Stripe' : 'Athlete price ID not configured.',
      environmentVariables: {
        'STRIPE_SECRET_KEY': stripeKey ? (stripeConfigured ? '✓ Valid key' : '✗ Invalid key') : '✗ Missing',
        'STRIPE_WEBHOOK_SECRET': webhookSecret ? '✓ Present' : '✗ Missing',
        'STRIPE_ATHLETE_PRICE_ID': athletePriceId ? (priceConfigured ? '✓ Valid ID' : '✗ Invalid ID') : '✗ Missing',
        'SUPABASE_URL': supabaseUrl ? '✓ Present' : '✗ Missing',
        'SUPABASE_SERVICE_ROLE_KEY': supabaseKey ? '✓ Present' : '✗ Missing'
      }
    };

    // Add logs to response if requested
    if (reqBody.fetchLogs) {
      response.logs = logs;
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: corsHeaders,
        status: 200
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
        stack: error.stack
      }),
      {
        headers: corsHeaders,
        status: 500
      }
    );
  }
});
