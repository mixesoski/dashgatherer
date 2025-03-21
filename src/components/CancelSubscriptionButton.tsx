
import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSubscription } from "@/hooks/useSubscription";

interface CancelSubscriptionButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

export const CancelSubscriptionButton = ({
  variant = "outline",
  className = "",
}: CancelSubscriptionButtonProps) => {
  const { subscription, cancelingSubscription, handleCancelSubscription } = useSubscription();

  // Don't render the button if there's no active subscription
  if (!subscription?.active || !subscription?.stripeSubscriptionId) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant={variant} 
          className={`${className} ${variant === "outline" ? "border-red-600 text-red-600 hover:bg-red-600 hover:text-white" : ""}`}
        >
          Cancel Subscription
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Cancel Subscription
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period.
            {subscription.cancelAt && (
              <p className="mt-2 font-medium">
                Your subscription will end on {new Date(subscription.cancelAt).toLocaleDateString()}.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep My Subscription</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleCancelSubscription();
            }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            disabled={cancelingSubscription}
          >
            {cancelingSubscription ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Canceling...
              </>
            ) : (
              "Yes, Cancel"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CancelSubscriptionButton;
