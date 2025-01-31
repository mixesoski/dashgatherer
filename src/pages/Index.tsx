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
import { User } from '@supabase/supabase-js';

// New component to handle individual athlete charts
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
        .select('athlete_id')
        .eq('coach_id', userId);

      if (error) return [];

      const athleteIds = data.map((relationship: { athlete_id: string }) => relationship.athlete_id);
      const { data: athleteDetails } = await supabase
        .from('user_roles')
        .select('user_id, users (email)')
        .in('user_id', athleteIds)
        .eq('role', 'athlete');

      return athleteDetails?.map((athlete: any) => ({
        id: athlete.user_id,
        email: athlete.users[0]?.email
      })) || [];
    },
    enabled: !!userId && roleData === 'coach'
  });

  // Rest of the existing code remains the same until the return statement...

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
                {/* Existing athlete content remains the same */}
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
