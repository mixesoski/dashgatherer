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
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";

// Get the API URL from environment variable or fallback to localhost for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const Index = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [showButtons, setShowButtons] = useState(true);

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

  const { data: garminData, refetch: refetchGarminData } = useQuery({
    queryKey: ['garminData'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garmin_data')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    }
  });

  useEffect(() => {
    // Get current user's ID when component mounts
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

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

  const handleSync = async () => {
    if (!userId) {
      toast.error('No user logged in');
      return;
    }

    try {
      const toastId = toast.loading('Syncing Garmin data...');
      
      // Get current user to verify
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      console.log('Using userId:', userId);
      
      if (!user || user.id !== userId) {
        toast.error('User authentication error', { id: toastId });
        return;
      }

      const response = await fetch(`${API_URL}/api/sync-garmin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      console.log('Raw response:', response);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        toast.success('Data synced successfully!', { id: toastId });
        setShowButtons(false);
        await refetchGarminData();
        console.log('Sync summary:', data.summary);
      } else {
        toast.error(data.error || 'Sync failed', { id: toastId });
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Error syncing data');
    }
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
              {showButtons && (
                <div className="flex justify-center gap-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button id="syncButton" variant="outline" className="gap-2" onClick={handleSync}>
                          <RefreshCw className="h-4 w-4" />
                          Sync Garmin
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Sync Garmin activities and TRIMP data</p>
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
              )}
              {garminData && garminData.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-2xl font-semibold mb-4">Your TRIMP Data</h2>
                  <div className="w-full h-[400px] bg-white rounded-lg shadow p-4">
                    <LineChart width={800} height={300} data={garminData}>
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis />
                      <RechartsTooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value: number) => [`${value}`, 'TRIMP']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="trimp" 
                        stroke="#0ea5e9" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </div>
                </div>
              )}
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