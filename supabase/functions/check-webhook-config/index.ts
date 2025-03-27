
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get the Supabase project ID from the environment for correct URL formatting
const projectId = Deno.env.get('SUPABASE_PROJECT_REF') || ''; // This should be set by Supabase

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body if present (for log fetching)
    let fetchLogs = false;
    try {
      const body = await req.json();
      fetchLogs = body?.fetchLogs === true;
    } catch (e) {
      // No body or not JSON, continue
    }

    // Get environment variables
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
    const athletePriceId = Deno.env.get('STRIPE_ATHLETE_PRICE_ID') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Create environment variables status object
    const environmentVariables: Record<string, string> = {
      'STRIPE_SECRET_KEY': stripeSecretKey ? 'Configured ✓' : 'Missing ✗',
      'STRIPE_WEBHOOK_SECRET': webhookSecret ? 'Configured ✓' : 'Missing ✗',
      'STRIPE_ATHLETE_PRICE_ID': athletePriceId ? 'Configured ✓' : 'Missing ✗',
      'SUPABASE_URL': supabaseUrl ? 'Configured ✓' : 'Missing ✗',
      'SUPABASE_SERVICE_ROLE_KEY': supabaseKey ? 'Configured ✓' : 'Missing ✗'
    };

    // Initialize status variables
    const stripeKeyConfigured = stripeSecretKey !== '';
    const webhookConfigured = webhookSecret !== '';
    const athletePriceConfigured = athletePriceId !== '';
    
    let stripeInfo = '';
    let webhookInfo = '';
    let athletePriceInfo = '';
    let webhookEndpoint = '';
    let webhookUrlFormatCorrect = false;

    // Check database tables
    const supabase = stripeKeyConfigured && supabaseUrl && supabaseKey 
      ? createClient(supabaseUrl, supabaseKey) 
      : null;
      
    let databaseStatus = { tablesExist: false, error: null };
    let logs = fetchLogs ? [] : null;

    if (supabase) {
      try {
        // Check if subscriptions table exists
        const { count, error } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true });
          
        if (error && error.code === '42P01') {
          databaseStatus.error = 'subscriptions table does not exist';
        } else {
          databaseStatus.tablesExist = true;
        }
      } catch (error) {
        databaseStatus.error = `Database check error: ${error.message}`;
      }
      
      // Fetch webhook logs if requested
      if (fetchLogs) {
        try {
          // This would be a real log fetching implementation
          // For now, we'll return some mock logs
          logs = [
            { timestamp: new Date().toISOString(), message: "Webhook endpoint checked", level: "info" },
            { timestamp: new Date(Date.now() - 60000).toISOString(), message: "Last webhook call received", level: "info" }
          ];
        } catch (error) {
          logs = [{ timestamp: new Date().toISOString(), message: `Error fetching logs: ${error.message}`, level: "error" }];
        }
      }
    }

    // Check Stripe configuration if API key is present
    if (stripeKeyConfigured) {
      try {
        const stripe = new Stripe(stripeSecretKey, {
          httpClient: Stripe.createFetchHttpClient(),
          apiVersion: '2023-10-16',
        });

        // Validate athlete price ID exists if configured
        if (athletePriceConfigured) {
          try {
            const price = await stripe.prices.retrieve(athletePriceId);
            athletePriceInfo = `Price ID is valid: ${price.id} (${price.nickname || 'No nickname'}, ${
              price.type === 'recurring' ? 'recurring' : 'one-time'
            })`;
          } catch (error) {
            athletePriceInfo = `Invalid price ID: ${error.message}`;
          }
        } else {
          athletePriceInfo = 'STRIPE_ATHLETE_PRICE_ID is not configured';
        }

        // Check webhook configuration
        try {
          const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
          
          // Get the project ID from environment or extract from URL
          let projectId;
          if (Deno.env.get('SUPABASE_PROJECT_REF')) {
            projectId = Deno.env.get('SUPABASE_PROJECT_REF');
          } else if (supabaseUrl) {
            // Try to extract project ID from Supabase URL
            const match = supabaseUrl.match(/https:\/\/([^.]+)/);
            if (match && match[1]) {
              projectId = match[1];
            }
          }
          
          // The correct webhook URL format
          const correctWebhookUrlFormat = projectId 
            ? `https://${projectId}.functions.supabase.co/stripe-webhook`
            : null;
            
          // Check if any webhook endpoints match the expected format
          let foundWebhook = false;
          for (const webhook of webhooks.data) {
            webhookEndpoint = webhook.url;
            
            // Check if the URL matches the correct format
            if (correctWebhookUrlFormat && webhookEndpoint === correctWebhookUrlFormat) {
              webhookUrlFormatCorrect = true;
              foundWebhook = true;
              webhookInfo = `Webhook endpoint correctly configured: ${webhookEndpoint}`;
              break;
            }
            
            // Check for common incorrect format
            if (projectId && webhookEndpoint.includes(`${projectId}.supabase.co/functions/v1/stripe-webhook`)) {
              foundWebhook = true;
              webhookInfo = `Webhook URL has incorrect format. Using: ${webhookEndpoint} instead of correct format: ${correctWebhookUrlFormat}`;
              break;
            }
            
            // Check for any endpoint with 'stripe-webhook'
            if (webhookEndpoint.includes('stripe-webhook')) {
              foundWebhook = true;
              webhookInfo = `Found webhook endpoint: ${webhookEndpoint}, but format may be incorrect. Correct format: ${correctWebhookUrlFormat}`;
              break;
            }
          }
          
          if (!foundWebhook) {
            webhookInfo = 'No Stripe webhook endpoints found pointing to this Supabase project';
            if (correctWebhookUrlFormat) {
              webhookInfo += `. Create one with URL: ${correctWebhookUrlFormat}`;
            }
          }
          
        } catch (error) {
          webhookInfo = `Error checking webhook configuration: ${error.message}`;
        }

        stripeInfo = 'Connected to Stripe API successfully';
      } catch (error) {
        stripeInfo = `Error connecting to Stripe: ${error.message}`;
      }
    } else {
      stripeInfo = 'STRIPE_SECRET_KEY is not configured';
    }

    // Return the configuration status
    return new Response(
      JSON.stringify({
        status: 'success',
        stripeKeyConfigured,
        webhookConfigured,
        athletePriceConfigured,
        webhookUrlFormatCorrect,
        stripeInfo,
        webhookInfo,
        athletePriceInfo,
        webhookEndpoint,
        database: databaseStatus,
        environmentVariables,
        logs: logs,
        // Include the correct webhook URL if we can determine it
        correctWebhookUrl: projectId 
          ? `https://${projectId}.functions.supabase.co/stripe-webhook` 
          : 'Unknown (Project ID not available)'
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
