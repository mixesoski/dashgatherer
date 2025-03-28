
// Configuration and environment variables
export const config = {
  stripe: {
    secretKey: Deno.env.get('STRIPE_SECRET_KEY') || '',
    webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET') || '',
    apiVersion: '2023-10-16' as const,
  },
  supabase: {
    url: Deno.env.get('SUPABASE_URL') || '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    projectRef: Deno.env.get('SUPABASE_PROJECT_REF') || '',
  }
};

export function getCorrectWebhookUrl(): string {
  if (config.supabase.projectRef) {
    return `https://${config.supabase.projectRef}.functions.supabase.co/stripe-webhook`;
  }
  return '';
}
