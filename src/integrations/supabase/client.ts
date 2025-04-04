
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://eeaebxnbcxhzafzpzqsu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYWVieG5iY3hoemFmenB6cXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxOTU5NjgsImV4cCI6MjA1Mjc3MTk2OH0.e4qePu5CkvdglzJlNtuVdTDAMZONdbDfvUxusG6XS9Q";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Helper function to update user profile
export const updateUserProfile = async (userId: string, profileData: Partial<Database['public']['Tables']['profiles']['Insert']>) => {
  return await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      ...profileData,
      updated_at: new Date().toISOString()
    });
}
