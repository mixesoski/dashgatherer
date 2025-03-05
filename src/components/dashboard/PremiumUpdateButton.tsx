import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { PremiumFeatureGuard } from "@/components/PremiumFeatureGuard";

interface PremiumUpdateButtonProps {
  onUpdate: () => Promise<void>;
  isUpdating: boolean;
  isSubmitting?: boolean;
}

export const PremiumUpdateButton: React.FC<PremiumUpdateButtonProps> = ({
  onUpdate,
  isUpdating,
  isSubmitting = false
}) => {
  return (
    <PremiumFeatureGuard featureName="Chart update">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onUpdate} 
        disabled={isUpdating || isSubmitting} 
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
        Update Chart
      </Button>
    </PremiumFeatureGuard>
  );
};

export default PremiumUpdateButton; 