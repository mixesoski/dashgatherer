import { supabase } from "@/integrations/supabase/client";

export const fetchAthletes = async () => {
  // Assuming your table is named "athletes" and the relationship to "auth.users" is set up as "user"
  const { data, error } = await supabase
    .from("coach_athletes")
    .select(`
      athlete_id,
      user:auth.users (
        email
      )
    `);

  if (error) {
    console.error("Error fetching athletes:", error);
    return [];
  }
  return data;
}; 