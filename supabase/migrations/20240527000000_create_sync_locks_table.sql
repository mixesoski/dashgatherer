-- Create sync_locks table for managing Garmin sync process locks
CREATE TABLE IF NOT EXISTS public.sync_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sync_locks_user_id_key UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.sync_locks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own sync locks"
  ON public.sync_locks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync locks"
  ON public.sync_locks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync locks"
  ON public.sync_locks FOR DELETE
  USING (auth.uid() = user_id); 