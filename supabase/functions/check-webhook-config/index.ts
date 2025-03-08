
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

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const athletePriceId = Deno.env.get('STRIPE_ATHLETE_PRICE_ID') || '';
  
  const config = {
    webhookConfigured: webhookSecret.length > 0,
    stripeKeyConfigured: stripeKey.length > 0,
    athletePriceConfigured: athletePriceId.length > 0,
    timestamp: new Date().toISOString(),
    message: "If webhook is configured but subscriptions aren't being saved, check Stripe Dashboard for webhook delivery status"
  };

  return new Response(
    JSON.stringify(config),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
