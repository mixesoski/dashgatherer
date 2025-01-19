import { GarminCredentialsForm } from "@/components/GarminCredentialsForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from 'react';
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { GarminChart } from "@/components/dashboard/GarminChart";
import DatePicker from 'react-datepicker';
import { subMonths, startOfDay, subDays } from 'date-fns';
import "react-datepicker/dist/react-datepicker.css";

// Get the API URL from environment variable or fallback to localhost for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const Index = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [showButtons, setShowButtons] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(subMonths(new Date(), 5));
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: garminCredentials, isLoading, refetch: refetchCredentials } = useQuery({
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
    queryKey: ['garminData', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('garmin_data')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!userId
  });

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (garminData && garminData.length > 0) {
      setShowButtons(false);
    }
  }, [garminData]);

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
    await refetchCredentials();
  };

  const handleSync = async () => {
    if (!userId || !startDate) {
      toast.error('No user logged in or start date not selected');
      return;
    }

    try {
      const toastId = toast.loading('Syncing Garmin data...');
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      console.log('Using userId:', userId);
      console.log('Start date:', startDate);
      
      if (!user || user.id !== userId) {
        toast.error('User authentication error', { id: toastId });
        return;
      }

      const response = await fetch(`${API_URL}/api/sync-garmin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id,
          startDate: startDate.toISOString()
        })
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

  const handleUpdate = async () => {
    if (!userId) return;
    
    try {
      setIsUpdating(true);
      const toastId = toast.loading('Checking for new activities...');
      
      // Get last 9 days
      const startDate = subDays(new Date(), 9);
      
      const response = await fetch(`${API_URL}/api/sync-garmin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId,
          startDate: startDate.toISOString(),
          updateOnly: true
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.newActivities > 0) {
          toast.success(`Added ${data.newActivities} new activities!`, { id: toastId });
        } else {
          toast.loading('Verifying and updating calculations...', { id: toastId });
          
          const recalcResponse = await fetch(`${API_URL}/api/sync-garmin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              userId,
              startDate: startDate.toISOString(),
              updateOnly: true,
              recalculateOnly: true
            })
          });
          
          const recalcData = await recalcResponse.json();
          if (recalcData.success) {
            toast.success('Calculations verified and updated', { id: toastId });
          } else {
            toast.error('Error verifying calculations', { id: toastId });
          }
        }
        await refetchGarminData();
      } else {
        toast.error(data.error || 'Update failed', { id: toastId });
      }
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Error updating data');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end mb-8">
          <ProfileMenu onDeleteGarminCredentials={handleDeleteCredentials} />
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Welcome to Your Dashboard</h1>
          {garminCredentials ? (
            <div className="space-y-4">
              <p className="text-xl text-gray-600">Your Garmin account is connected</p>
              <p className="text-md text-gray-500">Connected email: {garminCredentials.email}</p>
              {showButtons && (
                <div className="flex justify-center gap-4 items-center">
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
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Start from:</span>
                    <DatePicker
                      selected={startDate}
                      onChange={(date: Date) => setStartDate(startOfDay(date))}
                      maxDate={new Date()}
                      minDate={subMonths(new Date(), 5)}
                      className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      dateFormat="yyyy-MM-dd"
                      placeholderText="Select start date"
                      popperPlacement="bottom-end"
                      popperProps={{
                        positionFixed: true,
                        strategy: "fixed"
                      }}
                      calendarClassName="translate-y-2"
                    />
                  </div>
                </div>
              )}
              {garminData && garminData.length > 0 && (
                <GarminChart 
                  data={garminData} 
                  email={garminCredentials.email}
                  onUpdate={handleUpdate}
                  isUpdating={isUpdating}
                />
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
