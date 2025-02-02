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

interface AthleteWithEmail {
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
  const { data: athletes } = useQuery({
    queryKey: ['athletes', userId],
    queryFn: async () => {
      if (!userId || roleData !== 'coach') return [];
      
      const { data, error } = await supabase
        .from('coach_athletes')
        .select(`
          athlete_id,
          users (
            email
          )
        `)
        .eq('coach_id', userId);

      return data?.map(relationship => ({
        user_id: relationship.athlete_id,
        user: {
          email: relationship.users?.email || 'No email'
        }
      })) || [];
    },
    enabled: !!userId && roleData === 'coach'
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

  const selectedAthleteEmail = athletes?.find(athlete => athlete.user_id === selectedAthleteId)?.user.email;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end mb-8 gap-2">
          <InviteCoachDialog />
          <ProfileMenu onDeleteGarminCredentials={handleDeleteCredentials} />
        </div>

        {userRole === 'coach' && (
          <div className="space-y-8">
            <CoachDashboard
              athletes={athletes}
              selectedAthleteId={selectedAthleteId}
              onAthleteSelect={setSelectedAthleteId}
            />
          </div>
        )}

        <div className="text-center mb-12">
          {garminCredentials ? (
            <div className="space-y-4">
              <p className="text-xl text-gray-600">Your Garmin account is connected</p>
              <p className="text-md text-gray-500">Connected email: {selectedAthleteEmail || garminCredentials.email}</p>
              {showButtons && userRole !== 'coach' && (
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
                  email={selectedAthleteEmail || garminCredentials.email}
                  onUpdate={handleUpdate}
                  isUpdating={isUpdating}
                />
              )}
            </div>
          ) : userRole !== 'coach' ? (
            <>
              <p className="text-xl text-gray-600">Connect your Garmin account below</p>
              <GarminCredentialsForm />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Index;
