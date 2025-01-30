import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { GarminChart } from "@/components/dashboard/GarminChart";

interface AthleteData {
  id: string;
  email: string | null;
}

interface UserRoleData {
  user_id: string;
  user: {
    email: string;
  };
}

interface AthleteRole {
  user_id: string;
  user: {
    email: string;
  } | null;
}

const CoachDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [athletes, setAthletes] = useState<AthleteRole[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  // Fetch coach's athletes with accepted relationships
  const { data: acceptedAthletes } = useQuery({
    queryKey: ['acceptedAthletes'],
    queryFn: async () => {
      const { data: relationships, error } = await supabase
        .from('coach_athlete_relationships')
        .select('athlete_id')
        .eq('coach_id', (await supabase.auth.getUser()).data.user?.id)
        .eq('status', 'accepted');

      if (error) {
        console.error('Error fetching relationships:', error);
        return [];
      }

      return relationships || [];
    }
  });

  // Fetch athlete emails
  const { data: athleteEmails } = useQuery({
    queryKey: ['athleteEmails', acceptedAthletes],
    queryFn: async () => {
      if (!acceptedAthletes?.length) return [];

      const athleteIds = acceptedAthletes.map(rel => rel.athlete_id);
      
      const { data: athleteRoles, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          user:user_id (
            email
          )
        `)
        .in('user_id', athleteIds)
        .eq('role', 'athlete');

      if (error) {
        console.error('Error fetching athlete emails:', error);
        return [];
      }

      return athleteRoles || [];
    }
  });

  // Fetch Garmin data for selected athlete
  const { data: garminData, isLoading: isLoadingGarminData } = useQuery({
    queryKey: ['garminData', selectedAthleteId],
    queryFn: async () => {
      if (!selectedAthleteId) return null;

      const { data, error } = await supabase
        .from('garmin_data')
        .select('*')
        .eq('user_id', selectedAthleteId)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching Garmin data:', error);
        return null;
      }

      return data;
    },
    enabled: !!selectedAthleteId
  });

  // Search functionality
  const handleSearch = async () => {
    try {
      if (!searchTerm) {
        setAthletes([]);
        return;
      }

      const { data: athleteRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          user:user_id (
            email
          )
        `)
        .eq('role', 'athlete')
        .ilike('user->>email', `%${searchTerm}%`);

      if (rolesError) {
        console.error('Error searching athletes:', rolesError);
        return;
      }

      // Get existing relationships to filter out
      const { data: existingRelations } = await supabase
        .from('coach_athlete_relationships')
        .select('athlete_id')
        .eq('coach_id', (await supabase.auth.getUser()).data.user?.id);

      const existingAthleteIds = existingRelations?.map(rel => rel.athlete_id) || [];

      const formattedAthletes = (athleteRoles || [])
        .map((athlete: any) => ({
          user_id: athlete.user_id,
          user: athlete.user
        }))
        .filter(athlete => 
          athlete.user?.email && 
          !existingAthleteIds.includes(athlete.user_id)
        );

      setAthletes(formattedAthletes);
    } catch (error) {
      console.error('Error in search:', error);
    }
  };

  // Handle athlete selection
  const handleAthleteClick = (athleteId: string) => {
    setSelectedAthleteId(athleteId);
  };

  // Render athlete list with clickable items
  const renderAthleteList = () => {
    if (!athleteEmails?.length) {
      return <p className="text-gray-500 text-center py-4">No athletes data available</p>;
    }

    return athleteEmails.map((athlete: any) => (
      <div
        key={athlete.user_id}
        className={`p-4 border rounded-lg mb-2 cursor-pointer hover:bg-gray-50 ${
          selectedAthleteId === athlete.user_id ? 'bg-blue-50 border-blue-200' : ''
        }`}
        onClick={() => handleAthleteClick(athlete.user_id)}
      >
        <p className="font-medium">{athlete.user?.email}</p>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <Input
          type="text"
          placeholder="Search athletes by email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Athletes</h2>
          {renderAthleteList()}
        </div>
        
        <div className="md:col-span-2">
          {selectedAthleteId && garminData ? (
            <GarminChart 
              data={garminData}
              email={athleteEmails?.find(a => a.user_id === selectedAthleteId)?.user?.email || ''}
              onUpdate={async () => {}} // Empty function since coaches can't update athlete data
              isUpdating={false}
            />
          ) : (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">
                {isLoadingGarminData 
                  ? "Loading athlete data..." 
                  : "Select an athlete to view their training data"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachDashboard;