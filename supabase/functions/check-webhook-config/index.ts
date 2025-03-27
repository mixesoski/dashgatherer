
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
    
    // Check that the necessary environment variables are configured
    const stripeKeyConfigured = stripeKey !== '';
    const webhookSecretConfigured = webhookSecret !== '';
    const projectIdConfigured = projectId !== '';
    
    // Construct the correct webhook URL
    let webhookUrl = null;
    if (projectIdConfigured) {
      webhookUrl = `https://${projectId}.functions.supabase.co/stripe-webhook`;
    }
    
    // Return configuration status
    return new Response(
      JSON.stringify({ 
        status: 'success',
        stripeKeyConfigured,
        webhookSecretConfigured,
        projectIdConfigured,
        webhookConfigured: stripeKeyConfigured && webhookSecretConfigured && projectIdConfigured,
        webhookUrl
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
