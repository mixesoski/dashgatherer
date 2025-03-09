
import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePremiumFeatures } from '@/hooks/usePremiumFeatures';

export function SubscriptionBanner() {
  const { isSubscribed, isPending } = usePremiumFeatures();

  // Don't show the banner if the user is already subscribed or we're still checking
  if (isSubscribed || isPending) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-10 w-10 text-blue-500" />
            <div>
              <h3 className="text-lg font-medium text-blue-900">Unlock Premium Features</h3>
              <p className="text-blue-700">Get advanced analytics and unlimited data sync with a premium subscription</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/pricing">
              <Button className="bg-blue-600 hover:bg-blue-700">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-blue-700">Unlimited data sync</span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-blue-700">Advanced training metrics</span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-blue-700">Training load analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-blue-700">Priority support</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
