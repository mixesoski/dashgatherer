-- Enable RLS
alter table profiles enable row level security;

-- Create policies
create policy "Users can view own profile"
  on profiles for select
  using ( auth.uid() = user_id );

create policy "Users can insert own profile"
  on profiles for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = user_id ); 