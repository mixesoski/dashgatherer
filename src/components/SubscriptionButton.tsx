
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/services/stripe";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface SubscriptionButtonProps {
  planId: 'coach' | 'athlete' | 'organization';
  children: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link" | null | undefined;
  className?: string;
  redirectToLogin?: boolean;
}

export const SubscriptionButton = ({
  planId,
  children,
  variant = "default",
  className = "",
  redirectToLogin = false,
}: SubscriptionButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscribe = async () => {
    try {
      setLoading(true);

      // If redirectToLogin is true, we'll just redirect to login page with plan info
      if (redirectToLogin) {
        navigate(`/login?plan=${planId}`);
        return;
      }

      // Base URL for redirects
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/dashboard?subscription=success&plan=${planId}`;
      const cancelUrl = `${baseUrl}/pricing?subscription=canceled`;

      const result = await createCheckoutSession(planId, successUrl, cancelUrl);

      // Handle organization plan (contact sales)
      if (result.contactSales) {
        toast({
          title: "Contact Sales",
          description: result.message || "Please contact our sales team for organization pricing.",
        });
        return;
      }

      // For athlete plan, redirect to Stripe checkout
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Subscription error:", error);
      
      // If the error is due to not being logged in, redirect to login
      if (error.message?.includes("logged in")) {
        toast({
          title: "Login Required",
          description: "Please log in to subscribe to a plan.",
          variant: "destructive",
        });
        navigate(`/login?plan=${planId}`);
      } else {
        toast({
          title: "Subscription Error",
          description: error.message || "Something went wrong. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleSubscribe}
      disabled={loading}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
};

export default SubscriptionButton;
