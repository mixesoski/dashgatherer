
import { useQuery } from "@tanstack/react-query";
import { getSubscriptionStatus } from "@/services/stripe";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionStatus = {
  active: boolean;
  plan: string | null;
  role: string;
  status?: string;
  trialEnd: string | null;
  cancelAt: string | null;
  renewsAt: string | null;
};

export function useSubscription() {
  const [userId, setUserId] = useState<string | null>(null);

  // Check if user is logged in
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUserId(session?.user?.id || null);
      }
    );

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
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
    queryFn: getSubscriptionStatus,
    enabled: !!userId, // Only run query if userId exists
    retry: 1,
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
