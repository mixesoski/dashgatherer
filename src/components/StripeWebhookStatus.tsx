import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle, XCircle, ShieldAlert, ExternalLink, RefreshCw, Database, BarChart } from "lucide-react";
import { verifyStripeWebhookConfig } from "@/services/stripe";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const StripeWebhookStatus = () => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [subscriptionCount, setSubscriptionCount] = useState<number | null>(null);
  const [checkingDatabase, setCheckingDatabase] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "eeaebxnbcxhzafzpzqsu";
  const correctWebhookUrl = `https://${projectId}.functions.supabase.co/stripe-webhook`;
  const incorrectWebhookUrl = `https://${projectId}.supabase.co/functions/v1/stripe-webhook`;

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

  const fetchWebhookLogs = async () => {
    setFetchingLogs(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-webhook-config", {
        body: { fetchLogs: true }
      });
      
      if (error) {
        throw error;
      }
      
      if (data.logs) {
        setLogs(data.logs);
      } else {
        setLogs([{
          timestamp: new Date().toISOString(),
          message: "No logs available or log fetching not supported"
        }]);
      }
      
      setShowLogs(true);
    } catch (error: any) {
      console.error("Error fetching webhook logs:", error);
      toast.error(`Failed to fetch webhook logs: ${error.message}`);
      
      setLogs([{
        timestamp: new Date().toISOString(),
        message: `Error fetching logs: ${error.message}`,
        level: "error"
      }]);
      setShowLogs(true);
    } finally {
      setFetchingLogs(false);
    }
  };

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
          
          <div className="flex flex-wrap gap-2">
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
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchWebhookLogs} 
              disabled={fetchingLogs}
            >
              {fetchingLogs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <BarChart className={`mr-2 h-4 w-4 ${fetchingLogs ? 'hidden' : ''}`} />
              View Webhook Logs
            </Button>
          </div>
          
          <div className="mt-2 p-3 border border-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md">
            <h4 className="font-medium flex items-center text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              Important: Correct Webhook URL Format
            </h4>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              Your Stripe webhook must use this exact URL:
            </p>
            <code className="block mt-1 p-2 bg-white dark:bg-gray-800 border rounded text-sm break-all">
              {correctWebhookUrl}
            </code>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Common errors include using <code className="bg-white dark:bg-gray-800 px-1">{incorrectWebhookUrl}</code> (incorrect format)
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-bold">
              The URL should use <code className="bg-white dark:bg-gray-800 px-1">.functions.supabase.co/</code> and NOT <code className="bg-white dark:bg-gray-800 px-1">.supabase.co/functions/v1/</code>
            </p>
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
                <div className="flex justify-between">
                  <span>Webhook URL Format:</span>
                  <span>{config.webhookUrlFormatCorrect ? 
                    <CheckCircle className="h-4 w-4 text-green-500" /> : 
                    <XCircle className="h-4 w-4 text-red-500" />}
                  </span>
                </div>
              </div>
              
              <div className="text-xs space-y-2 border rounded-md p-3 bg-muted/50">
                <h4 className="font-semibold">Detailed Configuration</h4>
                <div className="grid grid-cols-1 gap-1">
                  {config.webhookInfo && <p>{config.webhookInfo}</p>}
                  {config.stripeInfo && <p>{config.stripeInfo}</p>}
                  {config.athletePriceInfo && <p>{config.athletePriceInfo}</p>}
                  {config.webhookEndpoint && (
                    <p className="text-gray-700 break-all">
                      <span className="font-medium">Webhook URL:</span> {config.webhookEndpoint}
                    </p>
                  )}
                  {config.database?.error && (
                    <p className="text-red-500">Database error: {config.database.error}</p>
                  )}
                </div>
              </div>
              
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
          
          {showLogs && logs.length > 0 && (
            <div className="mt-4 border rounded-md p-3">
              <h4 className="font-medium mb-2">Recent Webhook Logs</h4>
              <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                {logs.map((log, idx) => (
                  <div key={idx} className={`mb-1 ${log.level === 'error' ? 'text-red-400' : ''}`}>
                    <span className="text-gray-500">[{new Date(log.timestamp).toLocaleString()}]</span> {log.message}
                  </div>
                ))}
                {logs.length === 0 && <div>No logs available</div>}
              </div>
            </div>
          )}
          
          <div className="mt-4 text-xs text-muted-foreground">
            <p className="font-semibold">Troubleshooting Steps:</p>
            <ol className="list-decimal pl-5 space-y-1 mt-1">
              <li>Check that your Stripe secret and webhook secret are correctly set in Supabase Edge Function configuration</li>
              <li><strong>Verify your webhook URL is in the correct format:</strong> <code>{correctWebhookUrl}</code></li>
              <li><strong>Do not use</strong> <code>{incorrectWebhookUrl}</code> (incorrect format)</li>
              <li><strong>Important:</strong> Do not include any authorization token parameters or api keys in the webhook URL itself</li>
              <li>Make sure you have enabled the <code>checkout.session.completed</code> and subscription events</li>
              <li>If you're getting 401 errors, check that the webhook is configured in Supabase to allow unauthenticated requests</li>
              <li>Ensure headers in the webhook function allow the requests from Stripe</li>
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
              <a 
                href="https://stripe.com/docs/api/webhook_endpoints/create" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-500 hover:text-blue-700 ml-4"
              >
                Stripe API Webhook Reference <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StripeWebhookStatus;
