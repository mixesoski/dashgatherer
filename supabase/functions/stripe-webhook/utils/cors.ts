
// CORS headers configuration for webhook requests
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Handle CORS preflight requests
export function handleCorsPreflightRequest() {
  return new Response(null, { headers: corsHeaders });
}
