
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if this is the webhook endpoint accidentally being called
    const url = new URL(req.url);
    if (url.pathname.includes('webhook')) {
      log.error('Webhook request sent to checkout endpoint');
      return new Response(
        JSON.stringify({ 
          error: 'Incorrect endpoint',
          message: 'This appears to be a webhook request sent to the checkout endpoint'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const { planId, userId, successUrl, cancelUrl, metadata = {} } = await req.json();

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
          role: 'coach',
          updated_at: new Date().toISOString()
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
    if (userError || !userData?.user?.email) {
      log.error('Error fetching user email:', userError);
      throw new Error('Unable to fetch user email');
    }

    log.debug(`Creating checkout session for user: ${userId}, email: ${userData.user.email}`);

    // Merge metadata with required fields to ensure we have userId and planId
    const sessionMetadata = {
      ...metadata,
      userId: userId,
      planId: planId
    };

    // Create Stripe checkout session for athlete
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: planPriceIds.athlete,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId, // This is crucial - webhook uses this to identify the user
      customer_email: userData.user.email,
      metadata: sessionMetadata,
    });

    log.info(`Checkout session created: ${session.id}, URL: ${session.url}`);
    log.debug(`Session details: client_reference_id=${session.client_reference_id}, metadata=${JSON.stringify(session.metadata)}`);

    // Pre-create a subscription record with pending status
    // This helps ensure we have a record even if webhook fails
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_subscription_id: `pending_${session.id}`, // This will be updated by webhook
        status: 'pending',
        plan_id: planId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (subscriptionError) {
      log.error(`Error creating pending subscription: ${subscriptionError.message}`);
      // Continue anyway as this is just a precaution
    } else {
      log.info('Created pending subscription record');
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
