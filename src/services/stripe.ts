
import { supabase } from "@/integrations/supabase/client";

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

    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: {
        planId,
        userId: session.user.id,
        successUrl,
        cancelUrl
      }
    });

    if (error) {
      console.error("Error creating checkout session:", error);
      throw new Error(error.message || "Failed to create checkout session");
    }

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
    throw error;
  }
};
