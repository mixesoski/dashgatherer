
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

// Enhanced logging for debugging
const LOG_LEVEL = 'debug'; // 'debug' | 'info' | 'error'

const log = {
  debug: (...args: any[]) => {
    if (LOG_LEVEL === 'debug') {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'info') {
      console.log('[INFO]', ...args);
    }
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Price IDs for subscription plans
const planPriceIds = {
  coach: 'free', // Coach is free
  athlete: Deno.env.get('STRIPE_ATHLETE_PRICE_ID') || '',
  organization: 'custom' // Organizations need to contact sales
};

// Get the project ID for correct URL construction
const projectId = Deno.env.get('SUPABASE_PROJECT_REF') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { planId, userId, successUrl, cancelUrl } = await req.json();

    log.info(`Creating checkout session for plan: ${planId}, user: ${userId}`);
    log.debug(`Using price ID for athlete plan: ${planPriceIds.athlete}`);

    // Free coach subscription - no need for Stripe
    if (planId === 'coach') {
      log.info(`Assigning coach role directly for user: ${userId}`);
      // Update profile with coach role
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          user_id: userId, 
          role: 'coach'
          // updated_at will be set automatically by the trigger
        });

      if (error) {
        log.error(`Error updating profile with coach role: ${error.message}`);
        throw new Error(`Failed to update profile: ${error.message}`);
      }

      // Return success without Stripe checkout
      return new Response(
        JSON.stringify({ success: true, message: 'Coach role assigned' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Organization subscription - contact sales
    if (planId === 'organization') {
      log.info(`Organization plan requested for user: ${userId}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Please contact sales for organization pricing',
          contactSales: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify we have a valid price ID for athlete plan
    if (!planPriceIds.athlete || planPriceIds.athlete === '') {
      log.error('Missing athlete price ID in environment variables');
      throw new Error('Athlete price ID not configured');
    }

    // Get user email from Supabase
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData.user?.email) {
      log.error('Error fetching user email:', userError);
      throw new Error('Unable to fetch user email');
    }

    log.debug(`Creating checkout session for user: ${userId}, email: ${userData.user.email}`);

    // Create a pending subscription entry first
    const { error: pendingError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_subscription_id: 'pending_' + Date.now(), // Placeholder until webhook updates it
        plan_id: planId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (pendingError) {
      log.error(`Error creating pending subscription: ${pendingError.message}`);
      // Continue anyway as this is not critical
    } else {
      log.info('Created pending subscription record');
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: planPriceIds[planId as keyof typeof planPriceIds],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId, // This is crucial - webhook uses this to identify the user
      customer_email: userData.user.email,
      metadata: {
        userId: userId, // Add userId to metadata as a backup
        planId: planId  // Add planId to metadata for webhook processing
      },
    });

    log.info(`Checkout session created: ${session.id}, URL: ${session.url}`);
    log.debug(`Session details: client_reference_id=${session.client_reference_id}, metadata=${JSON.stringify(session.metadata)}`);

    // Note: Make sure the webhook URL is correct at https://[project-id].functions.supabase.co/stripe-webhook
    if (projectId) {
      log.debug(`Expected webhook URL: https://${projectId}.functions.supabase.co/stripe-webhook`);
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
