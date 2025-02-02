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

interface CoachAthleteJoin {
  athlete_id: string;
  user: {
    email: string;
  } | null;
}

interface Athlete {
  id: string;
  email: string;
}

const AthleteChart = ({ athleteId, email }: { athleteId: string, email: string }) => {
  const [startDate] = useState<Date | null>(subMonths(new Date(), 5));
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: garminCredentials } = useQuery({
    queryKey: ['garminCredentials', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garmin_credentials')
        .select('*')
        .eq('user_id', athleteId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: garminData, refetch: refetchGarminData } = useQuery({
    queryKey: ['garminData', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garmin_data')
        .select('*')
        .eq('user_id', athleteId)
        .order('date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      const success = await updateGarminData(athleteId);
      if (success) {
        await refetchGarminData();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (!garminCredentials) {
    return (
      <div className="mb-8">
        <p className="text-gray-500 mb-4">Athlete {email} hasn't connected Garmin</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">{email}'s Performance</h3>
      {garminData && garminData.length > 0 ? (
        <GarminChart 
          data={garminData} 
          email={email}
          onUpdate={handleUpdate}
          isUpdating={isUpdating}
        />
      ) : (
        <p className="text-gray-500">No data available for {email}</p>
      )}
    </div>
  );
};

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
      
      const { data, error } = await supabase
        .from('coach_athletes')
        .select(`
          athlete_id,
          user:users!athlete_id (email)
        `)
        .eq('coach_id', userId);

      if (error) {
        console.error('Error fetching coach athletes:', error);
        return [];
      }

      console.log('Fetched athlete IDs:', data);

      return (data as CoachAthleteJoin[]).map((relationship) => ({
        id: relationship.athlete_id,
        email: relationship.user?.email || 'No email'
      }));
    },
    enabled: !!userId && roleData === 'coach',
    onSuccess: (athletes) => {
      if (athletes.length > 0 && !selectedAthleteId) {
        setSelectedAthleteId(athletes[0].id); // Automatically select the first athlete
      }
    }
  });

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
    enabled: !!userId
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

      if (error) throw error;
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

  useEffect(() => {
    if (roleData) {
      setUserRole(roleData);
    }
  }, [roleData]);

  // Define the handleDeleteCredentials function
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
    if (!userId || !startDate) {
      toast.error('No user logged in or start date not selected');
      return;
    }

    const success = await syncGarminData(userId, startDate);
    if (success) {
      setShowButtons(false);
      await refetchGarminData();
    }
  };

  const handleUpdate = async () => {
    if (!userId) return;
    
    try {
      setIsUpdating(true);
      const success = await updateGarminData(userId);
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

        {userRole === 'coach' && athletes && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold mb-4">Athletes Overview</h2>
            {athletes.map((athlete) => (
              <AthleteChart 
                key={athlete.id}
                athleteId={athlete.id}
                email={athlete.email}
              />
            ))}
          </div>
        )}

        {userRole !== 'coach' && (
          <div className="text-center mb-12">
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
        )}
      </div>
    </div>
  );
};

export default Index;
