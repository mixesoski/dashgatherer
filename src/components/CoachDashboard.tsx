import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const CoachDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [athletes, setAthletes] = useState<any[]>([]);

  const searchAthletes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to search athletes');
        return;
      }

      // First get athletes from user_roles
      const { data: athleteRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, email:auth.users!user_roles_user_id_fkey(email)')
        .eq('role', 'athlete')
        .ilike('auth.users.email', `%${searchTerm}%`);

      if (rolesError) {
        console.error('Error fetching athletes:', rolesError);
        toast.error('Error searching athletes');
        return;
      }

      // Filter out any athletes that might already have a relationship with this coach
      const { data: existingRelations, error: relationsError } = await supabase
        .from('coach_athlete_relationships')
        .select('athlete_id')
        .eq('coach_id', user.id);

      if (relationsError) {
        console.error('Error checking existing relationships:', relationsError);
        return;
      }

      const existingAthleteIds = existingRelations?.map(rel => rel.athlete_id) || [];

      // Format athletes data, excluding those with existing relationships
      const formattedAthletes = athleteRoles
        ?.filter(athlete => !existingAthleteIds.includes(athlete.user_id))
        .map(athlete => ({
          user_id: athlete.user_id,
          email: athlete.email?.email // Note the nested email property due to the join
        }))
        .filter(athlete => athlete.email) || [];

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
      // Remove the invited athlete from the list
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
          <p className="text-3xl font-bold text-purple-600">0</p>
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
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">No recent activity</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachDashboard;