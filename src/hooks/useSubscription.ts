
import { useQuery } from "@tanstack/react-query";
import { getSubscriptionStatus, cancelSubscription } from "@/services/stripe";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SubscriptionStatus = {
  active: boolean;
  plan: string | null;
  role: string;
  status?: string;
  trialEnd: string | null;
  cancelAt: string | null;
  renewsAt: string | null;
  // Store the raw subscription ID for operations like cancel
  stripeSubscriptionId?: string;
  // Flag to indicate a pending checkout
  pendingCheckout?: boolean;
  // Flag to indicate cancellation in progress
  cancelingSubscription?: boolean;
};

export function useSubscription() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUserId = session?.user?.id || null;
        console.log(`Auth state changed: ${event}, User ID: ${newUserId}`);
        setUserId(newUserId);
      }
    );

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUserId = session?.user?.id || null;
      console.log(`Initial auth check: User ID: ${currentUserId}`);
      setUserId(currentUserId);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch subscription status
  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["subscription", userId],
    queryFn: async () => {
      console.log(`Fetching subscription status for user ID: ${userId}`);
      
      try {
        // First, directly check the subscriptions table
        if (userId) {
          // Check for active subscriptions
          const { data: directDbSubscription, error: dbError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
            
          if (dbError) {
            console.error("Error checking subscription directly in DB:", dbError);
          } else if (directDbSubscription) {
            console.log("Found active subscription directly in DB:", directDbSubscription);
            return {
              active: true,
              plan: directDbSubscription.plan_id,
              status: 'active',
              role: 'athlete', // Default role
              trialEnd: null,
              cancelAt: null,
              renewsAt: null,
              stripeSubscriptionId: directDbSubscription.stripe_subscription_id
            };
          } else {
            console.log("No active subscription found directly in DB");
          }
          
          // Check for pending subscriptions
          const { data: pendingSubscription, error: pendingError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .maybeSingle();
            
          if (pendingError) {
            console.error("Error checking pending subscription in DB:", pendingError);
          } else if (pendingSubscription) {
            console.log("Found pending subscription in DB:", pendingSubscription);
            
            // If the stripe_subscription_id doesn't start with 'pending_', it means it should be active
            if (pendingSubscription.stripe_subscription_id && 
                !pendingSubscription.stripe_subscription_id.startsWith('pending_')) {
              // Update it to active immediately in our app
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  status: 'active',
                  updated_at: new Date().toISOString()
                })
                .eq('id', pendingSubscription.id);
                
              if (updateError) {
                console.error("Error updating pending subscription to active:", updateError);
              } else {
                console.log("Successfully updated subscription to active from pending");
                
                // Return the now active subscription
                return {
                  active: true,
                  plan: pendingSubscription.plan_id,
                  status: 'active',
                  role: 'athlete',
                  trialEnd: null,
                  cancelAt: null,
                  renewsAt: null,
                  stripeSubscriptionId: pendingSubscription.stripe_subscription_id
                };
              }
            } else if (pendingSubscription.created_at) {
              // Check if the pending subscription is more than 10 minutes old
              const pendingTime = new Date(pendingSubscription.created_at).getTime();
              const currentTime = new Date().getTime();
              const tenMinutesInMs = 10 * 60 * 1000;
              
              if (currentTime - pendingTime > tenMinutesInMs) {
                // If it's been more than 10 minutes, try to call the webhook manually
                console.log("Pending subscription is more than 10 minutes old, trying to update status via edge function");
                
                try {
                  await supabase.functions.invoke("get-subscription-status", {
                    body: { userId: userId, forceFetch: true }
                  });
                  
                  // After the function call, refetch directly from the database
                  const { data: refreshSubscription } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'active')
                    .maybeSingle();
                    
                  if (refreshSubscription) {
                    console.log("Successfully updated subscription status to active");
                    return {
                      active: true,
                      plan: refreshSubscription.plan_id,
                      status: 'active',
                      role: 'athlete',
                      trialEnd: null,
                      cancelAt: null,
                      renewsAt: null,
                      stripeSubscriptionId: refreshSubscription.stripe_subscription_id
                    };
                  }
                } catch (webhookError) {
                  console.error("Failed to manually update subscription status:", webhookError);
                }
              }
              
              // Return the pending subscription info
              return {
                active: false,
                plan: pendingSubscription.plan_id,
                status: 'pending',
                role: 'athlete',
                trialEnd: null,
                cancelAt: null,
                renewsAt: null,
                pendingCheckout: true
              };
            }
          }
          
          // Also check for coach role which gets premium access
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();
            
          if (profileError) {
            console.error("Error checking user profile:", profileError);
          } else if (profileData?.role === 'coach') {
            console.log("User has coach role with premium access");
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
        }
        
        // Fall back to the edge function
        return await getSubscriptionStatus();
      } catch (error) {
        console.error("Failed to get subscription status:", error);
        toast.error("Failed to check subscription status. Please try again later.");
        throw error;
      }
    },
    enabled: !!userId, // Only run query if userId exists
    retry: 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    if (!subscription?.stripeSubscriptionId) {
      toast.error("No active subscription to cancel");
      return;
    }

    try {
      setCancelingSubscription(true);
      const result = await cancelSubscription(subscription.stripeSubscriptionId);
      
      if (result.success) {
        toast.success("Your subscription has been canceled");
        await refetch(); // Refresh subscription data
      } else {
        toast.error(result.message || "Failed to cancel subscription");
      }
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      toast.error(error.message || "Error canceling subscription");
    } finally {
      setCancelingSubscription(false);
    }
  };

  return {
    subscription: subscription as SubscriptionStatus,
    isLoading,
    error,
    refetch,
    cancelingSubscription,
    handleCancelSubscription
  };
}

export default useSubscription;
