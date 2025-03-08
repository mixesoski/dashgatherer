import { useEffect, useState } from "react";
import { getSubscriptionStatus } from "@/services/stripe";
import { supabase } from "@/integrations/supabase/client";

export function usePremiumFeatures() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let foundActiveSubscription = false;

        if (session?.user) {
          // First, always check if user has an active subscription directly in the subscriptions table
          const { data: directSubscriptionData, error: directSubscriptionError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .maybeSingle();
          
          if (directSubscriptionData && !directSubscriptionError) {
            // If we found an active subscription in the database, user has access
            foundActiveSubscription = true;
            setHasAccess(true);
            setSubscriptionData({
              active: true,
              plan: directSubscriptionData.plan_id,
              role: 'athlete', // Default to athlete for direct DB checks
              status: 'active'
            });
            console.log('Found active subscription in Supabase database:', directSubscriptionData);
            setIsLoading(false);
            return; // Skip the API call since we already found an active subscription
          }

          // Also check the profiles table for coach role which has free access
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (profileData?.role === 'coach' && !profileError) {
            setHasAccess(true);
            setSubscriptionData({
              active: true,
              plan: 'coach',
              role: 'coach',
              status: 'active'
            });
            console.log('User is a coach with premium access:', profileData);
            setIsLoading(false);
            return; // Skip further checks since coaches have access
          }
        }

        // If we didn't find an active subscription in the Supabase table directly,
        // try to get subscription status from the API as a fallback
        try {
          const data = await getSubscriptionStatus();
          
          // Users have access if:
          // 1. They have an active subscription
          // 2. They are a coach (coaches have free access)
          const hasFullAccess = data.active || data.role === 'coach';
          
          setHasAccess(hasFullAccess);
          setSubscriptionData(data);
        } catch (apiError) {
          console.error("Error checking premium access via API:", apiError);
          
          // If API call failed but we have already checked the database directly,
          // maintain the results from the direct DB check
          if (!foundActiveSubscription) {
            setHasAccess(false);
          }
        }
      } catch (error) {
        console.error("Error checking premium access:", error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, []);

  return {
    hasAccess,
    isLoading,
    subscriptionData
  };
}

export default usePremiumFeatures;
