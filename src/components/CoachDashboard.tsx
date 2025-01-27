import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CoachDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [athletes, setAthletes] = useState<any[]>([]);

  const searchAthletes = async () => {
    // First get the user's email from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin
      .listUsers({
        search: searchTerm,
      });

    if (authError) {
      console.error('Error searching users:', authError);
      return;
    }

    // Then get their roles
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', authUsers?.users.map(u => u.id) || [])
      .neq('role', 'coach');

    if (roleError) {
      console.error('Error fetching roles:', roleError);
      return;
    }

    // Combine the data
    const athletes = authUsers?.users
      .filter(user => roleData?.some(role => role.user_id === user.id))
      .map(user => ({
        user_id: user.id,
        email: user.email
      })) || [];

    setAthletes(athletes);
  };

  const sendInvitation = async (athleteId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase
      .from('coach_athlete_relationships')
      .insert({
        coach_id: user.id,
        athlete_id: athleteId,
        status: 'pending'
      });
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