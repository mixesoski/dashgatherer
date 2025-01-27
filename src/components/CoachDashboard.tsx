import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const CoachDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [athletes, setAthletes] = useState([]);

  const searchAthletes = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id, username')
      .ilike('username', `%${searchTerm}%`)
      .neq('role', 'coach');

    setAthletes(data);
  };

  const sendInvitation = async (athleteId) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase
      .from('coach_athlete_relationships')
      .insert({
        coach_id: user.id,
        athlete_id: athleteId,
        status: 'pending'
      });
  };

  return (
    <div>
      <h2>Wyszukaj zawodników</h2>
      <input
        type="text"
        placeholder="Wpisz nazwę zawodnika"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button onClick={searchAthletes}>Szukaj</button>

      <div>
        {athletes.map(athlete => (
          <div key={athlete.id}>
            <p>{athlete.username}</p>
            <button onClick={() => sendInvitation(athlete.id)}>
              Wyślij zaproszenie
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoachDashboard;