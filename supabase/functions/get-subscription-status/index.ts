
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    // First check if we have a subscription for this user in our database
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      throw subscriptionError;
    }

    // Get user role from user_roles table
    const { data: userRoleData, error: userRoleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (userRoleError && userRoleError.code !== 'PGRST116') {
      throw userRoleError;
    }

    // Handle the coach role separately (it's free)
    if (userRoleData?.role === 'coach') {
      return new Response(
        JSON.stringify({
          active: true,
          plan: 'coach',
          role: 'coach',
          trialEnd: null,
          cancelAt: null,
          renewsAt: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have a subscription in the database and it's connected to Stripe
    if (subscriptionData?.stripe_subscription_id) {
      // Fetch the latest subscription status from Stripe
      const subscription = await stripe.subscriptions.retrieve(
        subscriptionData.stripe_subscription_id
      );

      return new Response(
        JSON.stringify({
          active: subscription.status === 'active' || subscription.status === 'trialing',
          plan: subscriptionData.plan_id,
          status: subscription.status,
          role: userRoleData?.role || 'athlete',
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
          renewsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default response for users without a subscription
    return new Response(
      JSON.stringify({
        active: false,
        plan: null,
        status: 'no_subscription',
        role: userRoleData?.role || 'athlete',
        trialEnd: null,
        cancelAt: null,
        renewsAt: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
