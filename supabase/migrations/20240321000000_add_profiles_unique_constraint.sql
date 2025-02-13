-- Add unique constraint to user_id in profiles table
ALTER TABLE profiles
ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id); 