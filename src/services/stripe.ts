import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Creates a checkout session for subscribing to a plan
 */
export const createCheckoutSession = async (
  planId: string,
  successUrl: string,
  cancelUrl: string
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      throw new Error("User must be logged in to subscribe");
    }

    console.log(`Creating checkout session for user: ${session.user.id}, plan: ${planId}`);

    // First check that webhook configuration is correct
    try {
      const { data: webhookConfig } = await supabase.functions.invoke("check-webhook-config");
      console.log("Webhook configuration:", webhookConfig);
      
      if (!webhookConfig.webhookConfigured || !webhookConfig.stripeKeyConfigured) {
        console.warn("Stripe not fully configured:", webhookConfig);
      }
    } catch (configError) {
      console.warn("Could not check webhook configuration:", configError);
      // Continue anyway - don't block checkout process due to config check
    }

    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: {
        planId,
        userId: session.user.id,
        successUrl,
        cancelUrl,
        metadata: {
          userId: session.user.id,
          planId: planId
        }
      }
    });

    if (error) {
      console.error("Error creating checkout session:", error);
      throw new Error(error.message || "Failed to create checkout session");
    }

    console.log("Checkout session created:", data);

    // For organization plan, we return a special response to handle contact sales
    if (data.contactSales) {
      return { contactSales: true, message: data.message };
    }

    // For athlete plan, we redirect to the Stripe checkout URL
    return { url: data.url };
  } catch (error) {
    console.error("Error in createCheckoutSession:", error);
    throw error;
  }
};

/**
 * Gets subscription status for the current user
 */
export const getSubscriptionStatus = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      throw new Error("User must be logged in to check subscription");
    }

    console.log(`Checking subscription status for user: ${session.user.id}`);

    // First check directly in the database for an active subscription
    const { data: directSubscriptionData, error: directSubscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();
    
    if (directSubscriptionData && !directSubscriptionError) {
      console.log('Found active subscription directly in database:', directSubscriptionData);
      return {
        active: true,
        plan: directSubscriptionData.plan_id,
        status: 'active',
        role: 'athlete', // Default role, will be overridden if profile check succeeds
        trialEnd: null,
        cancelAt: null,
        renewsAt: null
      };
    }

    // Check for coach role in profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    if (profileData?.role === 'coach' && !profileError) {
      console.log('User is a coach with premium access:', profileData);
      return {
        active: true,
        plan: 'coach',
        status: 'active',
        role: 'coach',
        trialEnd: null,
        cancelAt: null,
        renewsAt: null
      };
    }

    // If no direct entry found, try the edge function
    try {
      const { data: webhookConfig } = await supabase.functions.invoke("check-webhook-config");
      console.log("Webhook configuration status:", webhookConfig.status);
    } catch (configError) {
      console.log("Webhook config check failed, continuing with subscription check:", configError);
      // We'll continue with the subscription check even if the config check fails
    }

    const { data, error } = await supabase.functions.invoke("get-subscription-status", {
      body: {
        userId: session.user.id
      }
    });

    if (error) {
      console.error("Error fetching subscription status:", error);
      throw new Error(error.message || "Failed to fetch subscription status");
    }

    return data;
  } catch (error) {
    console.error("Error in getSubscriptionStatus:", error);
    
    // If the edge function fails, try to get the basic role information from profiles
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();
        
      if (data) {
        return {
          role: data.role,
          active: data.role !== 'athlete', // Assuming non-athlete roles are active
          plan: data.role
        };
      }
    } catch (fallbackError) {
      console.error("Fallback profile check also failed:", fallbackError);
    }
    
    throw error;
  }
};

/**
 * Debug function to manually verify Stripe webhook configuration
 */
export const verifyStripeWebhookConfig = async () => {
  try {
    const response = await supabase.functions.invoke("check-webhook-config");
    return response.data;
  } catch (error) {
    console.error("Error verifying Stripe webhook configuration:", error);
    throw error;
  }
};
