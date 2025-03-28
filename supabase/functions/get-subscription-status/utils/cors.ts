
// CORS headers configuration
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
export function handleCorsPreflightRequest() {
  return new Response(null, { headers: corsHeaders });
}
