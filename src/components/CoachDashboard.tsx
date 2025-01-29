import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { GarminChart } from '@/components/dashboard/GarminChart';

interface AthleteData {
  id: string;
  email: string | null;
}

const CoachDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [athletes, setAthletes] = useState<any[]>([]);

  // Fetch coach's athletes with accepted relationships
  const { data: acceptedAthletes } = useQuery({
    queryKey: ['acceptedAthletes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get relationships and join with auth.users through user_roles
      const { data: relationships, error } = await supabase
        .from('coach_athlete_relationships')
        .select(`
          athlete_id,
          athlete:athlete_id (
            email
          )
        `)
        .eq('coach_id', user.id)
        .eq('status', 'accepted');

      if (error) {
        console.error('Error fetching accepted athletes:', error);
        return [];
      }

      return relationships.map(rel => ({
        id: rel.athlete_id,
        email: rel.athlete?.email
      })).filter((athlete): athlete is AthleteData => 
        athlete.id !== null && athlete.email !== null
      );
    }
  });

  // Fetch Garmin data for each athlete
  const { data: athletesData } = useQuery({
    queryKey: ['athletesGarminData', acceptedAthletes],
    queryFn: async () => {
      if (!acceptedAthletes?.length) return [];

      const athletesWithData = await Promise.all(
        acceptedAthletes.map(async (athlete) => {
          const { data, error } = await supabase
            .from('garmin_data')
            .select('*')
            .eq('user_id', athlete.id)
            .order('date', { ascending: true });

          if (error) {
            console.error(`Error fetching data for athlete ${athlete.email}:`, error);
            return null;
          }

          return {
            ...athlete,
            garminData: data || []
          };
        })
      );

      return athletesWithData.filter(Boolean);
    },
    enabled: !!acceptedAthletes?.length
  });

  const searchAthletes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to search athletes');
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
        .textSearch('user.email', searchTerm);

      if (rolesError) {
        console.error('Error fetching athletes:', rolesError);
        toast.error('Error searching athletes');
        return;
      }

      const { data: existingRelations, error: relationsError } = await supabase
        .from('coach_athlete_relationships')
        .select('athlete_id')
        .eq('coach_id', user.id);

      if (relationsError) {
        console.error('Error checking existing relationships:', relationsError);
        return;
      }

      const existingAthleteIds = existingRelations?.map(rel => rel.athlete_id) || [];

      const formattedAthletes = athleteRoles
        ?.map(athlete => ({
          user_id: athlete.user_id,
          email: athlete.user?.email
        }))
        .filter(athlete => 
          athlete.email && 
          !existingAthleteIds.includes(athlete.user_id)
        ) || [];

      setAthletes(formattedAthletes);
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while searching athletes');
    }
  };

  const sendInvitation = async (athleteId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to send invitations');
        return;
      }
      
      const { error } = await supabase
        .from('coach_athlete_relationships')
        .insert({
          coach_id: user.id,
          athlete_id: athleteId,
          status: 'pending'
        });

      if (error) {
        console.error('Error sending invitation:', error);
        toast.error('Failed to send invitation');
        return;
      }

      toast.success('Invitation sent successfully');
      setAthletes(athletes.filter(athlete => athlete.user_id !== athleteId));
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while sending the invitation');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-lg shadow dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-2">Total Athletes</h3>
          <p className="text-3xl font-bold text-purple-600">{acceptedAthletes?.length || 0}</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-2">Active Today</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-2">Pending Invites</h3>
          <p className="text-3xl font-bold text-orange-600">0</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
        <h2 className="text-xl font-bold mb-4">Search Athletes</h2>
        <div className="flex gap-4 mb-6">
          <Input
            type="text"
            placeholder="Search by athlete email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Button onClick={searchAthletes}>Search</Button>
        </div>

        <div className="space-y-4">
          {athletes.map(athlete => (
            <div key={athlete.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
              <span className="font-medium">{athlete.email}</span>
              <Button onClick={() => sendInvitation(athlete.user_id)} variant="outline">
                Send Invitation
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
        <h2 className="text-xl font-bold mb-6">Athletes Performance</h2>
        <div className="space-y-8">
          {athletesData?.map(athlete => (
            <div key={athlete.id} className="space-y-4">
              <GarminChart
                data={athlete.garminData}
                email={athlete.email}
                onUpdate={() => Promise.resolve()}
                isUpdating={false}
              />
            </div>
          ))}
          {!athletesData?.length && (
            <p className="text-gray-500 text-center py-4">No athletes data available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachDashboard;
