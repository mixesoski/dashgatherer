import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getSubscriptionStatus } from "@/services/stripe";
import { Loader2, CreditCard, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const SubscriptionBanner = () => {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        // First, try the API call
        const data = await getSubscriptionStatus();
        setSubscription(data);
      } catch (error) {
        console.error("Error loading subscription from API:", error);
        
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
              console.log('SubscriptionBanner: Found active subscription in database:', subscriptionData);
              setSubscription({
                active: true,
                plan: subscriptionData.plan_id,
                role: 'athlete', // Default to athlete
                status: 'active'
              });
            } else {
              // Also check for coach role in profiles
              const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (profileData?.role === 'coach') {
                setSubscription({
                  active: true,
                  plan: 'coach',
                  role: 'coach',
                  status: 'active'
                });
              } else {
                setSubscription({
                  active: false,
                  plan: null,
                  role: 'athlete',
                  status: 'no_subscription'
                });
              }
            }
          }
        } catch (fallbackError) {
          console.error("Subscription banner fallback check also failed:", fallbackError);
          setSubscription({
            active: false,
            plan: null,
            role: 'athlete',
            status: 'error'
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, []);

  if (loading) {
    return (
      <Card className="mb-6 bg-white/50 backdrop-blur">
        <CardContent className="flex items-center justify-center p-4">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Loading subscription status...</span>
        </CardContent>
      </Card>
    );
  }

  // If user is a coach, no need to show subscription banner
  if (subscription?.role === "coach") {
    return null;
  }

  // If user has an active subscription, show minimal info
  if (subscription?.active) {
    return (
      <Card className="mb-6 bg-gradient-to-r from-green-50 to-green-100 border-green-200">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <CreditCard className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">
              Active <strong className="capitalize">{subscription.plan}</strong> subscription
            </span>
          </div>
          <Link to="/subscription">
            <Button variant="outline" size="sm" className="border-green-500 text-green-700 hover:bg-green-50">
              Manage
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // No active subscription
  return (
    <Card className="mb-6 bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
          <span className="text-amber-800">
            No active subscription - Some features may be limited
          </span>
        </div>
        <div className="flex gap-2">
          <Link to="/subscription">
            <Button variant="outline" size="sm" className="border-amber-500 text-amber-700 hover:bg-amber-50">
              View Details
            </Button>
          </Link>
          <Link to="/pricing">
            <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
              Subscribe Now
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionBanner; 