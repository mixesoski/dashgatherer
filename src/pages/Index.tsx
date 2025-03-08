
import React, { useEffect, useState } from 'react';
import { GarminCredentialsForm } from "@/components/GarminCredentialsForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { GarminChart } from "@/components/dashboard/GarminChart";
import DatePicker from 'react-datepicker';
import { subMonths, startOfDay } from 'date-fns';
import "react-datepicker/dist/react-datepicker.css";
import { syncGarminData, updateGarminData } from "@/utils/garminSync";
import { InviteCoachDialog } from "@/components/dashboard/InviteCoachDialog";
import CoachDashboard from "@/components/dashboard/CoachDashboard";
import { ProgressToast } from "@/components/ui/ProgressToast";
import { Logo } from "@/components/Logo";
import { SubscriptionBanner } from "@/components/dashboard/SubscriptionBanner";
import { PremiumFeatureGuard } from "@/components/PremiumFeatureGuard";
import { usePremiumFeatures } from "@/hooks/usePremiumFeatures";

interface Athlete {
  user_id: string;
  user: {
    email: string;
  };
}

const Index = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [showButtons, setShowButtons] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(subMonths(new Date(), 5));
  const [isUpdating, setIsUpdating] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const {
    data: roleData
  } = useQuery({
    queryKey: ['userRole', userId],
    queryFn: async () => {
      if (!userId) return null;
      const {
        data,
        error
      } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data?.role;
    },
    enabled: !!userId
  });

  const {
    data: athletes
  } = useQuery<Athlete[]>({
    queryKey: ['athletes', userId],
    queryFn: async () => {
      if (!userId || roleData !== 'coach') return [];
      console.log('Fetching athletes for coach:', userId);
      
      const {
        data: coachData,
        error: coachError
      } = await supabase
        .from('coach_athletes')
        .select('athlete_id, athlete_email')
        .eq('coach_id', userId);
      
      console.log('Raw coach data:', coachData);
      
      if (coachError) {
        console.error('Coach data fetch error:', coachError);
        return [];
      }
      
      if (!coachData || !Array.isArray(coachData)) {
        console.log('No coach data or not an array');
        return [];
      }
      
      return coachData.map(row => ({
        user_id: row.athlete_id,
        user: {
          email: row.athlete_email || row.athlete_id
        }
      }));
    },
    enabled: !!userId && roleData === 'coach'
  });

  const relevantUserId = userRole === 'coach' ? selectedAthleteId : userId;

  const {
    data: garminCredentials,
    isLoading: isCredentialsLoading,
    refetch: refetchCredentials
  } = useQuery({
    queryKey: ['garminCredentials', userId],
    queryFn: async () => {
      if (!userId) return null;
      const {
        data,
        error
      } = await supabase.from('garmin_credentials').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && userRole !== 'coach'
  });

  const {
    data: garminData,
    isLoading: isDataLoading,
    refetch: refetchGarminData
  } = useQuery({
    queryKey: ['garminData', relevantUserId],
    queryFn: async () => {
      if (!relevantUserId) return [];
      const {
        data,
        error
      } = await supabase.from('garmin_data').select('*').eq('user_id', relevantUserId).order('date', {
        ascending: true
      });
      if (error) throw error;
      return (data || []).filter(r => r !== undefined);
    },
    enabled: !!relevantUserId
  });

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } finally {
        setTimeout(() => {
          setIsInitialLoading(false);
        }, 1000);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (garminData && garminData.length > 0) {
      setShowButtons(false);
    }
  }, [garminData]);

  useEffect(() => {
    if (roleData) {
      setUserRole(roleData);
    }
  }, [roleData]);

  const handleDeleteCredentials = async () => {
    if (!userId) return;
    const {
      error
    } = await supabase.from('garmin_credentials').delete().eq('user_id', userId);
    if (error) {
      toast.error("Failed to delete Garmin credentials");
      return;
    }
    toast.success("Garmin credentials deleted successfully");
    await refetchCredentials();
  };

  const handleSync = async () => {
    if (!relevantUserId || !startDate) {
      toast.error('No user logged in or start date not selected');
      return;
    }
    setIsUpdating(true);
    toast.custom(() => <ProgressToast message="Syncing Garmin data..." />);
    const success = await syncGarminData(relevantUserId, startDate);
    if (success) {
      setShowButtons(false);
      await refetchGarminData();
      toast.success("Data synced successfully");
    } else {
      toast.error("Failed to sync data");
    }
    setIsUpdating(false);
  };

  const handleUpdate = async () => {
    if (!relevantUserId) return;
    try {
      setIsUpdating(true);
      toast.custom(() => <ProgressToast message="Updating Garmin data..." />);
      const success = await updateGarminData(relevantUserId);
      if (success) {
        await refetchGarminData();
        toast.success("Data updated successfully");
      } else {
        toast.error("Failed to update data");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (isInitialLoading) {
    return <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
        <p className="text-xl font-medium text-gray-700">Loading your training data...</p>
      </div>;
  }

  return <div className="min-h-screen bg-gray-100 py-8 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between mb-8">
          <Logo variant="dark" />
          <div className="flex gap-2">
            <InviteCoachDialog />
            <ProfileMenu onDeleteGarminCredentials={handleDeleteCredentials} />
          </div>
        </div>

        <SubscriptionBanner />

        {userRole === 'coach' ? <>
            <CoachDashboard athletes={athletes} selectedAthleteId={selectedAthleteId} onAthleteSelect={setSelectedAthleteId} />
            {selectedAthleteId ? <div className="bg-white p-6 rounded-lg shadow mb-8">
                <GarminChart data={garminData?.filter(Boolean) || []} email={athletes?.find(a => a.user_id === selectedAthleteId)?.user.email || "No email"} onUpdate={handleUpdate} isUpdating={isUpdating} />
              </div> : <p className="text-gray-600"></p>}
          </> : <>
            {garminCredentials ? <div className="space-y-4">
                <p className="text-xl text-gray-600">Your Garmin account is connected</p>
                <p className="text-md text-gray-500">Connected email: {garminCredentials.email}</p>
                {showButtons && <div className="flex justify-center gap-4 items-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button id="syncButton" variant="outline" className="gap-2" onClick={handleSync} disabled={isUpdating}>
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
                      <DatePicker selected={startDate} onChange={(date: Date) => setStartDate(startOfDay(date))} maxDate={new Date()} minDate={subMonths(new Date(), 5)} className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" dateFormat="yyyy-MM-dd" placeholderText="Select start date" popperPlacement="bottom-end" popperProps={{
                strategy: "fixed"
              }} calendarClassName="translate-y-2" disabled={isUpdating} />
                    </div>
                  </div>}
              </div> : <>
                <p className="text-xl text-gray-600">Connect your Garmin account below</p>
                <GarminCredentialsForm />
              </>}
            <div className="bg-white p-6 rounded-lg shadow mb-8 my-[73px]">
              <GarminChart data={garminData?.filter(Boolean) || []} email={garminCredentials?.email || ""} onUpdate={handleUpdate} isUpdating={isUpdating} />
            </div>
          </>}
      </div>
    </div>;
};

export default Index;
