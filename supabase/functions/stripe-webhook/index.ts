
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCorsPreflightRequest } from "./utils/cors.ts";
import { log } from "./utils/logger.ts";
import { handleWebhookEvent } from "./handlers/webhook-handler.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    log.info('Webhook request received');
    
    // Log request details for debugging
    const url = new URL(req.url);
    log.info(`Request method: ${req.method}, path: ${url.pathname}`);
    
    return await handleWebhookEvent(req);
  } catch (err) {
    log.error(`Webhook Error: ${err.message}`, err);
    return new Response(`Webhook Error: ${err.message}`, { 
      status: 400,
      headers: corsHeaders
    });
  }
});
