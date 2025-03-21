
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

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
      console.error('Webhook request sent to checkout endpoint');
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
    const { planId, userId, successUrl, cancelUrl } = await req.json();

    console.log(`Creating checkout session for plan: ${planId}, user: ${userId}`);
    console.log(`Using price ID for athlete plan: ${planPriceIds.athlete}`);

    // Free coach subscription - no need for Stripe
    if (planId === 'coach') {
      // Update user profile to coach
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'coach' })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Error updating profile to coach:', profileError);
        throw new Error('Failed to update user role');
      }

      // Return success without Stripe checkout
      return new Response(
        JSON.stringify({ success: true, message: 'Coach role assigned' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Organization subscription - contact sales
    if (planId === 'organization') {
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
      console.error('Missing athlete price ID in environment variables');
      throw new Error('Athlete price ID not configured');
    }

    // Get user email from Supabase
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData.user?.email) {
      console.error('Error fetching user email:', userError);
      throw new Error('Unable to fetch user email');
    }

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
      client_reference_id: userId, // This is critical to identify the user
      customer_email: userData.user.email,
      metadata: {
        userId: userId, // Store user ID in metadata for double safety
        planId: planId, // Store plan ID in metadata
      },
    });

    console.log(`Checkout session created: ${session.id}, URL: ${session.url}`);
    console.log(`Session metadata: ${JSON.stringify(session.metadata)}`);
    console.log(`Client reference ID: ${session.client_reference_id}`);

    // Log the webhook endpoint configuration for debugging
    try {
      const webhookEndpoints = await stripe.webhookEndpoints.list({ limit: 10 });
      console.log('Configured webhook endpoints:', webhookEndpoints.data.map(endpoint => ({
        url: endpoint.url,
        enabled_events: endpoint.enabled_events,
        status: endpoint.status
      })));
    } catch (error) {
      console.error('Error fetching webhook endpoints:', error.message);
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
