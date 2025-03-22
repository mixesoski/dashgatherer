
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { verifyStripeWebhookConfig } from "@/services/stripe";
import { toast } from "sonner";

export const StripeWebhookStatus = () => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);

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
    } catch (error) {
      console.error("Error checking webhook:", error);
      toast.error("Failed to check webhook configuration");
    } finally {
      setLoading(false);
    }
  };

  // Only for admins/developers
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Stripe Test Mode Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Verify that Stripe webhook is properly configured in TEST MODE to process payments.
          </p>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkWebhookConfig} 
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Check Webhook Configuration
          </Button>
          
          {config && (
            <div className="mt-4 text-sm space-y-2 border rounded-md p-3">
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
            </div>
          )}
          
          <div className="text-xs text-muted-foreground mt-4 border-t pt-4">
            <h4 className="font-medium mb-2">Stripe Test Mode Setup Instructions:</h4>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Use a <strong>test mode API key</strong> starting with <code>sk_test_</code></li>
              <li>Create a webhook endpoint in the Stripe dashboard (Test mode)</li>
              <li>Copy the webhook signing secret starting with <code>whsec_</code></li>
              <li>Configure these secrets in your Supabase Edge Functions</li>
              <li>Your webhook URL should be: <code>https://eeaebxnbcxhzafzpzqsu.functions.supabase.co/stripe-webhook</code></li>
              <li>Enable these events: <code>checkout.session.completed</code>, <code>customer.subscription.updated</code>, <code>customer.subscription.deleted</code></li>
            </ol>
            <div className="mt-3">
              <a 
                href="https://dashboard.stripe.com/test/webhooks" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-500 hover:text-blue-700"
              >
                Stripe Test Webhooks <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StripeWebhookStatus;
