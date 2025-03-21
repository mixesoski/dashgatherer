
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
    // Parse request body
    const { subscriptionId, userId } = await req.json();
    
    console.log(`Canceling subscription: ${subscriptionId} for user: ${userId}`);

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ error: 'Subscription ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the subscription belongs to the user
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('user_id', userId)
      .single();
      
    if (subscriptionError || !subscriptionData) {
      console.error('Error verifying subscription ownership:', subscriptionError);
      return new Response(
        JSON.stringify({ 
          error: 'Could not verify subscription ownership',
          details: subscriptionError?.message
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Cancel the subscription in Stripe
      const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
      
      console.log(`Stripe subscription canceled: ${subscriptionId}, status: ${canceledSubscription.status}`);
      
      // Update our database
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscriptionId)
        .eq('user_id', userId);
        
      if (updateError) {
        console.error('Error updating subscription in database:', updateError);
        // Still return success since the Stripe cancellation worked
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Subscription canceled successfully',
          stripeStatus: canceledSubscription.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (stripeError) {
      console.error('Error canceling Stripe subscription:', stripeError);
      
      // If it's already canceled or doesn't exist in Stripe, we'll still update our database
      if (stripeError.code === 'resource_missing') {
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({ 
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscriptionId)
          .eq('user_id', userId);
          
        if (updateError) {
          console.error('Error updating subscription in database:', updateError);
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Subscription marked as canceled in our system',
            warning: 'Subscription was not found in Stripe, possibly already canceled'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to cancel subscription in Stripe',
          details: stripeError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in cancel-subscription function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
