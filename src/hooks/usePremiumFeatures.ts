
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
        // First, try to get subscription status from the API
        const data = await getSubscriptionStatus();
        
        // If API check fails or returns no active subscription, check the subscriptions table directly
        if (!data.active) {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            // Check if user has an active subscription in the subscriptions table
            const { data: subscriptionData, error } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('status', 'active')
              .maybeSingle();
            
            if (subscriptionData && !error) {
              // If we found an active subscription in the database, override the API result
              data.active = true;
              data.plan = subscriptionData.plan_id;
              console.log('Found active subscription in database:', subscriptionData);
            }
          }
        }
        
        // Users have access if:
        // 1. They have an active subscription
        // 2. They are a coach (coaches have free access)
        const hasFullAccess = data.active || data.role === 'coach';
        
        setHasAccess(hasFullAccess);
        setSubscriptionData(data);
      } catch (error) {
        console.error("Error checking premium access:", error);
        
        // Fallback: Check directly in the database if the API call fails
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            // Check if user has an active subscription in the subscriptions table
            const { data: subscriptionData, error } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('status', 'active')
              .maybeSingle();
            
            if (subscriptionData && !error) {
              setHasAccess(true);
              setSubscriptionData({
                active: true,
                plan: subscriptionData.plan_id,
                role: 'athlete' // Default to athlete for direct DB checks
              });
              console.log('Found active subscription in database (fallback):', subscriptionData);
            } else {
              // Also check the profiles table for coach role
              const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (profileData?.role === 'coach') {
                setHasAccess(true);
                setSubscriptionData({
                  active: true,
                  plan: 'coach',
                  role: 'coach'
                });
              } else {
                setHasAccess(false);
              }
            }
          } else {
            setHasAccess(false);
          }
        } catch (fallbackError) {
          console.error("Fallback check also failed:", fallbackError);
          setHasAccess(false);
        }
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
