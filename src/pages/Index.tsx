import React, { useEffect, useState } from 'react';
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
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { GarminChart } from "@/components/dashboard/GarminChart";
import DatePicker from 'react-datepicker';
import { subMonths, startOfDay } from 'date-fns';
import "react-datepicker/dist/react-datepicker.css";
import { syncGarminData, updateGarminData } from "@/utils/garminSync";
import { InviteCoachDialog } from "@/components/dashboard/InviteCoachDialog";
import CoachDashboard from "@/components/dashboard/CoachDashboard";

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

  // Fetch user role
  const { data: roleData } = useQuery({
    queryKey: ['userRole', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data?.role;
    },
    enabled: !!userId
  });

  // Fetch athletes if user is a coach
  const { data: athletes } = useQuery<Athlete[]>({
    queryKey: ['athletes', userId],
    queryFn: async () => {
      if (!userId || roleData !== 'coach') return [];
      
      console.log('Fetching athletes for coach:', userId);
      
      // Get athlete IDs managed by this coach with their auth and profile information
      const { data: coachData, error: coachError } = await supabase
        .from('coach_athletes')
        .select(`
          athlete_id,
          athlete:profiles!inner (
            email:user_id,
            garmin_email
          )
        `)
        .eq('coach_id', userId);

      console.log('Raw coach data:', coachData);
      console.log('Coach data error:', coachError);

      if (coachError) {
        console.error('Coach data fetch error:', coachError);
        return [];
      }
      if (!coachData || !Array.isArray(coachData)) {
        console.log('No coach data or not an array');
        return [];
      }

      // Add type assertion for coachData
      const typedCoachData = coachData as unknown as Array<{
        athlete_id: string;
        athlete: {
          email: string;
          garmin_email: string | null;
        };
      }>;

      const mappedAthletes = typedCoachData.map(row => ({
        user_id: row.athlete_id,
        user: { 
          email: row.athlete.email || row.athlete.garmin_email || 'No email'
        }
      }));

      console.log('Mapped athletes:', mappedAthletes);
      return mappedAthletes;
    },
    enabled: !!userId && roleData === 'coach'
  });

  // Before garminData query, define relevantUserId
  const relevantUserId = userRole === 'coach' ? selectedAthleteId : userId;

  // Update garminCredentials query to run only for athletes
  const { data: garminCredentials, isLoading, refetch: refetchCredentials } = useQuery({
    queryKey: ['garminCredentials', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('garmin_credentials')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId && userRole !== 'coach'
  });

  // Update garminData query to use relevantUserId
  const { data: garminData, refetch: refetchGarminData } = useQuery({
    queryKey: ['garminData', relevantUserId],
    queryFn: async () => {
      if (!relevantUserId) return [];
      const { data, error } = await supabase
        .from('garmin_data')
        .select('*')
        .eq('user_id', relevantUserId)
        .order('date', { ascending: true });
      if (error) throw error;
      return (data || []).filter(r => r !== undefined);
    },
    enabled: !!relevantUserId
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

  useEffect(() => {
    if (roleData) {
      setUserRole(roleData);
    }
  }, [roleData]);

  const handleDeleteCredentials = async () => {
    if (!userId) return;
    
    const { error } = await supabase
      .from('garmin_credentials')
      .delete()
      .eq('user_id', userId);

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
    const success = await syncGarminData(relevantUserId, startDate);

    if (success) {
      setShowButtons(false);
      await refetchGarminData();
    }
  };

  const handleUpdate = async () => {
    if (!relevantUserId) return;
    try {
      setIsUpdating(true);
      const success = await updateGarminData(relevantUserId);
      if (success) {
        await refetchGarminData();
      }
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
        <div className="flex justify-end mb-8 gap-2">
          <InviteCoachDialog />
          <ProfileMenu onDeleteGarminCredentials={handleDeleteCredentials} />
        </div>

        {userRole === 'coach' ? (
          <>
            <CoachDashboard athletes={athletes} selectedAthleteId={selectedAthleteId} onAthleteSelect={setSelectedAthleteId} />
            {selectedAthleteId ? (
              <div className="bg-white p-6 rounded-lg shadow mb-8">
                <GarminChart 
                  data={garminData?.filter(Boolean) || []}
                  email={athletes?.find(a => a.user_id === selectedAthleteId)?.user.email || "No email"}
                  onUpdate={handleUpdate}
                  isUpdating={isUpdating}
                />
              </div>
            ) : (
              <p className="text-gray-600"></p>
            )}
          </>
        ) : (
          <>
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
                          strategy: "fixed"
                        }}
                        calendarClassName="translate-y-2"
                      />
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
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <GarminChart 
                data={garminData?.filter(Boolean) || []}
                email={garminCredentials?.email || ""}
                onUpdate={handleUpdate}
                isUpdating={isUpdating}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;