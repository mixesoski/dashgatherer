
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';

export function TrialBanner() {
  const { subscription, isLoading } = useSubscription();
  
  // If user already has a subscription or data is loading, don't show the banner
  if (isLoading || (subscription && subscription.active)) {
    return null;
  }
  
  const daysLeft = 26; // Mock trial period remaining - could be dynamic
  
  return (
    <Card className="mb-6 bg-gray-50 border border-gray-200">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Trial period active</h3>
            <p className="text-gray-600 mt-1">
              Your free trial will end in {daysLeft} days. Subscribe now to continue using all of Trimpbara's features.
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" asChild>
            <Link to="/subscription">
              Subscribe now
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
