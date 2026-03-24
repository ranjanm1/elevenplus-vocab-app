-- Run this in Supabase SQL Editor to enable proper student names in admin analytics.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

-- Optional backfill for existing users who already signed up.
insert into public.profiles (id, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.email
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists students_parent_primary_unique
  on public.students (parent_user_id)
  where is_primary = true;

alter table public.students enable row level security;

drop policy if exists "Parents can view own students" on public.students;
create policy "Parents can view own students"
  on public.students
  for select
  using (auth.uid() = parent_user_id);

drop policy if exists "Parents can insert own students" on public.students;
create policy "Parents can insert own students"
  on public.students
  for insert
  with check (auth.uid() = parent_user_id);

drop policy if exists "Parents can update own students" on public.students;
create policy "Parents can update own students"
  on public.students
  for update
  using (auth.uid() = parent_user_id)
  with check (auth.uid() = parent_user_id);

drop policy if exists "Admins can view all students" on public.students;
create policy "Admins can view all students"
  on public.students
  for select
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

-- Optional backfill: creates a primary student row when student_name exists in auth metadata.
insert into public.students (parent_user_id, full_name, is_primary)
select
  u.id,
  nullif(trim(u.raw_user_meta_data ->> 'student_name'), ''),
  true
from auth.users u
where nullif(trim(u.raw_user_meta_data ->> 'student_name'), '') is not null
  and not exists (
    select 1
    from public.students s
    where s.parent_user_id = u.id
      and s.is_primary = true
  );
