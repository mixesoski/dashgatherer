import React from "react";
import { Link } from "react-router-dom";
import { usePremiumFeatures } from "@/hooks/usePremiumFeatures";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

interface PremiumFeatureGuardProps {
  children: React.ReactNode;
  featureName?: string;
}

export const PremiumFeatureGuard: React.FC<PremiumFeatureGuardProps> = ({ 
  children, 
  featureName = "This feature" 
}) => {
  const { hasAccess, isLoading } = usePremiumFeatures();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <Card>
      <CardContent className="p-6 flex flex-col items-center justify-center text-center">
        <Lock className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-xl font-bold mb-2">Premium Feature</h3>
        <p className="text-gray-600 mb-6">
          {featureName} requires an active subscription. 
          Upgrade now to access all premium features.
        </p>
        <div className="flex gap-3">
          <Link to="/subscription">
            <Button variant="outline">Subscription Details</Button>
          </Link>
          <Link to="/pricing">
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Upgrade Now
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default PremiumFeatureGuard; 