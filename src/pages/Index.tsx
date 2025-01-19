import { Button } from "@/components/ui/button";
import { GarminCredentialsForm } from "@/components/GarminCredentialsForm";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Index = () => {
  const navigate = useNavigate();

  const { data: garminCredentials, isLoading } = useQuery({
    queryKey: ['garminCredentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garmin_credentials')
        .select('*')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleDeleteCredentials = async () => {
    const { error } = await supabase
      .from('garmin_credentials')
      .delete()
      .single();

    if (error) {
      toast.error("Failed to delete Garmin credentials");
      return;
    }

    toast.success("Garmin credentials deleted successfully");
    // This will trigger a refetch of the credentials
    window.location.reload();
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end mb-8">
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Welcome to Your Dashboard</h1>
          {garminCredentials ? (
            <div className="space-y-4">
              <p className="text-xl text-gray-600">Your Garmin account is connected</p>
              <p className="text-md text-gray-500">Connected email: {garminCredentials.email}</p>
              <div className="flex justify-center gap-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button id="syncButton" variant="outline" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Sync Garmin
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Coming Soon</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button 
                  onClick={handleDeleteCredentials}
                  variant="destructive"
                >
                  Remove Garmin Connection
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xl text-gray-600">Connect your Garmin account below</p>
              <GarminCredentialsForm />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;