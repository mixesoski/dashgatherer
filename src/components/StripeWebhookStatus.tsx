
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle, XCircle, ShieldAlert, ExternalLink, RefreshCw, Database } from "lucide-react";
import { verifyStripeWebhookConfig } from "@/services/stripe";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const StripeWebhookStatus = () => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [subscriptionCount, setSubscriptionCount] = useState<number | null>(null);
  const [checkingDatabase, setCheckingDatabase] = useState(false);

  const checkWebhookConfig = async () => {
    setLoading(true);
    try {
      const configData = await verifyStripeWebhookConfig();
      setConfig(configData);
      
      if (configData.webhookConfigured && configData.stripeKeyConfigured) {
        toast.success("Stripe webhook is configured correctly");
      } else {
        toast.error("Stripe webhook configuration issues detected");
      }
    } catch (error: any) {
      console.error("Error checking webhook:", error);
      toast.error("Failed to check webhook configuration");
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionsInDatabase = async () => {
    setCheckingDatabase(true);
    try {
      const { count, error } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        throw error;
      }
      
      setSubscriptionCount(count);
      
      if (count && count > 0) {
        toast.success(`Found ${count} subscription records in the database`);
      } else {
        toast.info("No subscription records found in the database");
      }
    } catch (error: any) {
      console.error("Error checking subscriptions:", error);
      toast.error(`Failed to check subscriptions: ${error.message}`);
    } finally {
      setCheckingDatabase(false);
    }
  };

  // Only for admins/developers
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Stripe Integration Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Check that Stripe webhook is properly configured to process payments.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkWebhookConfig} 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'hidden' : ''}`} />
              Check Webhook Configuration
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkSubscriptionsInDatabase} 
              disabled={checkingDatabase}
            >
              {checkingDatabase && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Database className={`mr-2 h-4 w-4 ${checkingDatabase ? 'hidden' : ''}`} />
              Check Subscriptions in Database
            </Button>
          </div>
          
          {config && (
            <div className="mt-4 space-y-4">
              <div className="text-sm space-y-2 border rounded-md p-3">
                <div className="flex justify-between">
                  <span>Webhook Secret:</span>
                  <span>{config.webhookConfigured ? 
                    <CheckCircle className="h-4 w-4 text-green-500" /> : 
                    <XCircle className="h-4 w-4 text-red-500" />}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Stripe API Key:</span>
                  <span>{config.stripeKeyConfigured ? 
                    <CheckCircle className="h-4 w-4 text-green-500" /> : 
                    <XCircle className="h-4 w-4 text-red-500" />}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Price ID:</span>
                  <span>{config.athletePriceConfigured ? 
                    <CheckCircle className="h-4 w-4 text-green-500" /> : 
                    <XCircle className="h-4 w-4 text-red-500" />}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Database Tables:</span>
                  <span>{config.database?.tablesExist ? 
                    <CheckCircle className="h-4 w-4 text-green-500" /> : 
                    <XCircle className="h-4 w-4 text-red-500" />}
                  </span>
                </div>
              </div>
              
              {/* Detailed configuration info */}
              <div className="text-xs space-y-2 border rounded-md p-3 bg-muted/50">
                <h4 className="font-semibold">Detailed Configuration</h4>
                <div className="grid grid-cols-1 gap-1">
                  {config.webhookInfo && <p>{config.webhookInfo}</p>}
                  {config.stripeInfo && <p>{config.stripeInfo}</p>}
                  {config.athletePriceInfo && <p>{config.athletePriceInfo}</p>}
                  {config.database?.error && (
                    <p className="text-red-500">Database error: {config.database.error}</p>
                  )}
                </div>
              </div>
              
              {/* Environment variables section */}
              <div className="text-xs space-y-2 border rounded-md p-3 bg-muted/50">
                <h4 className="font-semibold">Environment Variables</h4>
                <div className="grid grid-cols-1 gap-1">
                  {Object.entries(config.environmentVariables).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span className={value.includes('✓') ? 'text-green-500' : 'text-red-500'}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {subscriptionCount !== null && (
            <div className="mt-2 p-3 border rounded-md">
              <span className="font-medium">Subscription records in database: </span>
              <span>{subscriptionCount}</span>
            </div>
          )}
          
          <div className="mt-4 text-xs text-muted-foreground">
            <p className="font-semibold">Troubleshooting Steps:</p>
            <ol className="list-decimal pl-5 space-y-1 mt-1">
              <li>Check that your Stripe secret and webhook secret are correctly set in Supabase Edge Function configuration</li>
              <li>Verify your webhook URL is correctly configured in Stripe dashboard</li>
              <li>Make sure the <code>stripe-signature</code> header is being sent with webhook requests</li>
              <li>Check that you have enabled the <code>checkout.session.completed</code> and subscription events</li>
              <li>The webhook URL should be: <code>https://[project-id].functions.supabase.co/stripe-webhook</code></li>
            </ol>
            <div className="mt-2">
              <a 
                href="https://stripe.com/docs/webhooks/quickstart" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-500 hover:text-blue-700"
              >
                Stripe Webhook Documentation <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StripeWebhookStatus;
