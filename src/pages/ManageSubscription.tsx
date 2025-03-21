
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSubscriptionStatus } from "@/services/stripe";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Calendar, BadgeAlert, CheckCircle, XCircle, Loader2, Home } from "lucide-react";
import { toast } from "sonner";
import { getPlanName } from "@/utils/subscription";
import { Logo } from "@/components/Logo";
import { useSubscription } from "@/hooks/useSubscription";
import { CancelSubscriptionButton } from "@/components/CancelSubscriptionButton";

const ManageSubscription = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { subscription, isLoading: subscriptionLoading } = useSubscription();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/login");
          return;
        }

        setUserId(user.id);
      } catch (error: any) {
        toast.error(error.message || "Error checking authentication");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active' || status === 'trialing') {
      return <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-xs font-medium"><CheckCircle className="h-3.5 w-3.5" /> Active</span>;
    } else if (status === 'canceled' || status === 'incomplete_expired') {
      return <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-xs font-medium"><XCircle className="h-3.5 w-3.5" /> Canceled</span>;
    } else if (status === 'past_due' || status === 'incomplete') {
      return <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2.5 py-0.5 rounded-full text-xs font-medium"><BadgeAlert className="h-3.5 w-3.5" /> Past Due</span>;
    } else {
      return <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-full text-xs font-medium">No Subscription</span>;
    }
  };

  if (loading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <Link to="/dashboard" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <Logo variant="dark" />
        </Link>
        <Link to="/dashboard">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            <CardTitle>Subscription Management</CardTitle>
          </div>
          <CardDescription>
            Manage your subscription and billing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!subscription || subscription.active === false ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium">No Active Subscription</h3>
              <p className="text-muted-foreground mt-2">
                You don't currently have an active subscription.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
                <Button onClick={() => navigate("/pricing")}>
                  View Pricing Plans
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-lg font-medium mb-2">Subscription Details</h3>
                <div className="rounded-md border p-4 grid gap-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span>{getStatusBadge(subscription.status || '')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">{getPlanName(subscription.plan)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium capitalize">{subscription.role}</span>
                  </div>
                </div>
              </div>

              {subscription.trialEnd && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium">Trial Period</h3>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trial ends on</span>
                      <span className="font-medium">{formatDate(subscription.trialEnd)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Billing Information</h3>
                </div>
                <div className="rounded-md border p-4 grid gap-3">
                  {subscription.renewsAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next billing date</span>
                      <span className="font-medium">{formatDate(subscription.renewsAt)}</span>
                    </div>
                  )}
                  {subscription.cancelAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cancels on</span>
                      <span className="font-medium">{formatDate(subscription.cancelAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
        <Separator />
        <CardFooter className="flex justify-between pt-6">
          <Button variant="outline" onClick={() => navigate("/account")}>
            Back to Account
          </Button>
          
          {/* This CancelSubscriptionButton will only be visible for active subscriptions */}
          <CancelSubscriptionButton 
            variant="outline" 
            className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
          />
        </CardFooter>
      </Card>
    </div>
  );
};

export default ManageSubscription;
