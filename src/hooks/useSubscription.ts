
import { useQuery } from "@tanstack/react-query";
import { getSubscriptionStatus } from "@/services/stripe";
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
};

export function useSubscription() {
  const [userId, setUserId] = useState<string | null>(null);

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

  return {
    subscription: subscription as SubscriptionStatus,
    isLoading,
    error,
    refetch,
  };
}

export default useSubscription;
