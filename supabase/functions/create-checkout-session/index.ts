
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

// Update the price IDs here
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
    // Parse request body
    const { planId, userId, successUrl, cancelUrl } = await req.json();

    // Free coach subscription - no need for Stripe
    if (planId === 'coach') {
      // Update user role to coach in the database
      await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: 'coach' });

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

    // Create Stripe checkout session for athlete
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
      client_reference_id: userId,
      customer_email: (await supabase.auth.admin.getUserById(userId)).data.user?.email,
      metadata: {
        userId,
        planId,
      },
    });

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
