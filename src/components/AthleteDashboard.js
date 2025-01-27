import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const AthleteDashboard = () => {
  const [invitations, setInvitations] = useState([]);

  const fetchInvitations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data } = await supabase
      .from('coach_athlete_relationships')
      .select(`
        id,
        coach:coach_id (username, avatar_url),
        created_at
      `)
      .eq('athlete_id', user.id)
      .eq('status', 'pending');

    setInvitations(data);
  };

  const acceptInvitation = async (invitationId) => {
    await supabase
      .from('coach_athlete_relationships')
      .update({ status: 'accepted' })
      .eq('id', invitationId);

    fetchInvitations();
  };

  useEffect(() => {
    fetchInvitations();
    
    // Real-time updates
    const subscription = supabase
      .channel('invitations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'coach_athlete_relationships',
        filter: `athlete_id=eq.${user.id}`
      }, () => {
        fetchInvitations();
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  return (
    <div>
      <h2>Twoje zaproszenia</h2>
      {invitations.map(invite => (
        <div key={invite.id}>
          <img src={invite.coach.avatar_url} alt="Trener" />
          <p>Od: {invite.coach.username}</p>
          <button onClick={() => acceptInvitation(invite.id)}>
            Zaakceptuj
          </button>
        </div>
      ))}
    </div>
  );
};

export default AthleteDashboard;