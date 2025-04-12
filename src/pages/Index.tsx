import React, { useEffect, useState } from 'react';
import { GarminCredentialsForm } from "@/components/GarminCredentialsForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Loader2, ArrowDownCircle, BarChart2, Activity, Calendar, Users, Settings, Info } from "lucide-react";
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
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { getUserFriendlyErrorMessage } from "@/utils/errorMessages";

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
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const {
    data: roleData
  } = useQuery({
    queryKey: ['userRole', userId],
    queryFn: async () => {
      if (!userId) return null;
      const {
        data,
        error
      } = await supabase.from('profiles').select('role, email').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      setUserEmail(data?.email || null);
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
      } = await supabase.from('coach_athletes').select('athlete_id, athlete_email').eq('coach_id', userId);
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
      toast.error(getUserFriendlyErrorMessage(error));
      return;
    }
    toast.success("Garmin connection removed successfully");
    await refetchCredentials();
  };

  const handleSync = async () => {
    if (!relevantUserId || !startDate) {
      toast.error('Please log in and select a start date before syncing');
      return;
    }
    setIsUpdating(true);
    toast.custom(() => <ProgressToast message="Syncing with Garmin Connect..." />);
    const success = await syncGarminData(relevantUserId, startDate);
    if (success) {
      setShowButtons(false);
      await refetchGarminData();
      toast.success("Your training data has been successfully synced");
    } else {
      toast.error("We couldn't sync your Garmin data. Please check your credentials and try again");
    }
    setIsUpdating(false);
  };

  const handleUpdate = async () => {
    if (!relevantUserId) return;
    try {
      setIsUpdating(true);
      toast.custom(() => <ProgressToast message="Updating your latest training data..." />);
      const success = await updateGarminData(relevantUserId);
      if (success) {
        await refetchGarminData();
        toast.success("Your training data has been updated successfully");
      } else {
        toast.error("We couldn't update your training data. Please try again later");
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

  return <div className="flex h-screen bg-gray-50">
      <DashboardSidebar userRole={userRole} userEmail={userEmail} />
      
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-between items-center">
          <div className="flex items-center">
            <Logo variant="dark" className="h-8 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <InviteCoachDialog />
            <ProfileMenu onDeleteGarminCredentials={handleDeleteCredentials} />
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6">
          <TrialBanner />
          
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Let's get started</h1>
            <p className="text-gray-600 mt-1">
              Connect your Garmin account and start tracking your training metrics
            </p>
          </div>
          
          {userRole === 'coach' ? <>
              <Card className="mb-6">
                <CardContent className="p-6">
                  <CoachDashboard athletes={athletes} selectedAthleteId={selectedAthleteId} onAthleteSelect={setSelectedAthleteId} />
                </CardContent>
              </Card>
              
              {selectedAthleteId ? <Card>
                  <CardContent className="p-6">
                    <GarminChart data={garminData?.filter(Boolean) || []} email={athletes?.find(a => a.user_id === selectedAthleteId)?.user.email || "No email"} onUpdate={handleUpdate} isUpdating={isUpdating} />
                  </CardContent>
                </Card> : <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm text-center">
                  <Info className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">Select an athlete</h3>
                  <p className="mt-2 text-gray-500">
                    Please select an athlete from the list above to view their training data
                  </p>
                </div>}
            </> : <>
              {garminCredentials ? <div className="space-y-6">
                  <Card className="border border-gray-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Garmin Connection Status</h3>
                      <div className="flex items-center gap-2 text-green-600 mb-4">
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                        <span className="font-medium">Connected</span>
                      </div>
                      <p className="text-gray-600">Connected email: <span className="font-medium">{garminCredentials.email}</span></p>
                    </CardContent>
                  </Card>
                  
                  {showButtons && <Card className="border border-blue-200 bg-blue-50">
                      <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Sync Your Data</h3>
                            <p className="text-gray-600">Start by syncing your Garmin data to see your training metrics</p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">Start from:</span>
                              <DatePicker selected={startDate} onChange={(date: Date) => setStartDate(startOfDay(date))} maxDate={new Date()} className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" dateFormat="yyyy-MM-dd" placeholderText="Select start date" popperPlacement="bottom-end" popperProps={{
                        strategy: "fixed"
                      }} calendarClassName="translate-y-2" disabled={isUpdating} />
                            </div>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button id="syncButton" variant="default" className="gap-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 px-6 w-full sm:w-auto" onClick={handleSync} disabled={isUpdating}>
                                    {isUpdating ? <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Syncing...
                                      </> : <>
                                        <RefreshCw className="h-4 w-4" />
                                        Sync Garmin
                                      </>}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Sync Garmin activities and TRIMP data</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </CardContent>
                    </Card>}
                </div> : <Card className="border border-gray-200">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Start with connecting Garmin Connect</h3>
                    <GarminCredentialsForm />
                  </CardContent>
                </Card>}
              
              <div className="mt-6">
                <Card className="border border-gray-200">
                  <CardContent className="p-6">
                    <GarminChart data={garminData?.filter(Boolean) || []} email={garminCredentials?.email || ""} onUpdate={handleUpdate} isUpdating={isUpdating} />
                  </CardContent>
                </Card>
              </div>
            </>}
          
          <div className="mt-6">
            <SubscriptionBanner />
          </div>
        </main>
      </div>
    </div>;
};

export default Index;
