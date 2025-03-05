import { useEffect, useState } from "react";
import { getSubscriptionStatus } from "@/services/stripe";

export function usePremiumFeatures() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const data = await getSubscriptionStatus();
        
        // Users have access if:
        // 1. They have an active subscription
        // 2. They are a coach (coaches have free access)
        const hasFullAccess = data.active || data.role === 'coach';
        
        setHasAccess(hasFullAccess);
        setSubscriptionData(data);
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