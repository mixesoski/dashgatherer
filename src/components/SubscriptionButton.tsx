
import React from 'react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionPlan } from '@/services/stripe';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionButtonProps {
  planId: SubscriptionPlan;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  children: React.ReactNode;
}

export const SubscriptionButton = ({
  planId,
  className,
  variant = "default",
  children
}: SubscriptionButtonProps) => {
  const { loading, subscribeToPlan } = useSubscription();
  const navigate = useNavigate();

  const handleClick = async () => {
    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // If not logged in, redirect to login page with return URL
      navigate('/login', { 
        state: { returnUrl: `/pricing?plan=${planId}` } 
      });
      return;
    }

    // If logged in, proceed with subscription
    subscribeToPlan(planId);
  };

  return (
    <Button 
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? 'Processing...' : children}
    </Button>
  );
};
