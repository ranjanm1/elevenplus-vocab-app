create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'assessment_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.assessment_type as enum (
      'vocab_quiz',
      'comprehension',
      'spag',
      'cloze',
      'mixed'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'assignment_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.assignment_status as enum (
      'assigned',
      'in_progress',
      'submitted',
      'reviewed',
      'expired',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'attempt_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.attempt_status as enum (
      'not_started',
      'in_progress',
      'submitted',
      'reviewed',
      'abandoned'
    );
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = coalesce(check_user_id, auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.is_parent_of_student(
  target_student_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students
    where id = target_student_id
      and parent_user_id = coalesce(check_user_id, auth.uid())
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated, service_role;
grant execute on function public.is_parent_of_student(uuid, uuid) to authenticated, service_role;

create table if not exists public.assessment_definitions (
  id uuid primary key default gen_random_uuid(),
  type public.assessment_type not null,
  title text not null,
  description text,
  instructions text,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_definitions_title_not_blank
    check (char_length(trim(title)) > 0),
  constraint assessment_definitions_config_is_object
    check (jsonb_typeof(config) = 'object')
);

create table if not exists public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_definition_id uuid not null
    references public.assessment_definitions(id) on delete cascade,
  item_order integer not null,
  item_type text not null,
  prompt text,
  passage text,
  metadata jsonb not null default '{}'::jsonb,
  answer_key jsonb,
  max_score numeric(8, 2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_items_unique_order
    unique (assessment_definition_id, item_order),
  constraint assessment_items_item_type_not_blank
    check (char_length(trim(item_type)) > 0),
  constraint assessment_items_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint assessment_items_max_score_non_negative
    check (max_score >= 0)
);

create table if not exists public.assessment_item_words (
  assessment_item_id uuid not null
    references public.assessment_items(id) on delete cascade,
  word_id uuid not null
    references public.vocabulary_words(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (assessment_item_id, word_id)
);

create table if not exists public.assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  assessment_definition_id uuid not null
    references public.assessment_definitions(id) on delete restrict,
  student_id uuid not null
    references public.students(id) on delete restrict,
  assigned_by uuid not null
    references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  available_from timestamptz,
  due_at timestamptz,
  max_attempts integer,
  status public.assignment_status not null default 'assigned',
  metadata jsonb not null default '{}'::jsonb,
  constraint assessment_assignments_max_attempts_positive
    check (max_attempts is null or max_attempts > 0),
  constraint assessment_assignments_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint assessment_assignments_due_after_available
    check (
      due_at is null
      or available_from is null
      or due_at >= available_from
    )
);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid
    references public.assessment_assignments(id) on delete set null,
  assessment_definition_id uuid not null
    references public.assessment_definitions(id) on delete restrict,
  student_id uuid not null
    references public.students(id) on delete restrict,
  user_id uuid not null
    references auth.users(id) on delete restrict,
  attempt_number integer not null default 1,
  status public.attempt_status not null default 'not_started',
  started_at timestamptz,
  submitted_at timestamptz,
  auto_score numeric(8, 2),
  manual_score numeric(8, 2),
  final_score numeric(8, 2),
  max_score numeric(8, 2),
  percentage numeric(5, 2),
  feedback text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_attempts_attempt_number_positive
    check (attempt_number > 0),
  constraint assessment_attempts_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint assessment_attempts_percentage_range
    check (percentage is null or (percentage >= 0 and percentage <= 100)),
  constraint assessment_attempts_submitted_after_started
    check (
      submitted_at is null
      or started_at is null
      or submitted_at >= started_at
    ),
  constraint assessment_attempts_reviewed_after_submission
    check (
      reviewed_at is null
      or submitted_at is null
      or reviewed_at >= submitted_at
    ),
  constraint assessment_attempts_scores_non_negative
    check (
      (auto_score is null or auto_score >= 0)
      and (manual_score is null or manual_score >= 0)
      and (final_score is null or final_score >= 0)
      and (max_score is null or max_score >= 0)
    )
);

create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.assessment_attempts(id) on delete cascade,
  assessment_item_id uuid not null
    references public.assessment_items(id) on delete cascade,
  response jsonb not null default '{}'::jsonb,
  auto_score numeric(8, 2),
  manual_score numeric(8, 2),
  final_score numeric(8, 2),
  is_correct boolean,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_responses_unique_attempt_item
    unique (attempt_id, assessment_item_id),
  constraint assessment_responses_response_is_json
    check (jsonb_typeof(response) in ('object', 'array', 'string', 'number', 'boolean', 'null')),
  constraint assessment_responses_scores_non_negative
    check (
      (auto_score is null or auto_score >= 0)
      and (manual_score is null or manual_score >= 0)
      and (final_score is null or final_score >= 0)
    )
);

create index if not exists assessment_definitions_active_idx
  on public.assessment_definitions (active, type);

create index if not exists assessment_items_definition_order_idx
  on public.assessment_items (assessment_definition_id, item_order);

create index if not exists assessment_item_words_word_idx
  on public.assessment_item_words (word_id);

create index if not exists assessment_assignments_student_status_idx
  on public.assessment_assignments (student_id, status, due_at);

create index if not exists assessment_assignments_definition_idx
  on public.assessment_assignments (assessment_definition_id);

create index if not exists assessment_attempts_student_created_idx
  on public.assessment_attempts (student_id, created_at desc);

create index if not exists assessment_attempts_assignment_idx
  on public.assessment_attempts (assignment_id);

create index if not exists assessment_attempts_user_idx
  on public.assessment_attempts (user_id, created_at desc);

create unique index if not exists assessment_attempts_assignment_attempt_number_idx
  on public.assessment_attempts (assignment_id, attempt_number)
  where assignment_id is not null;

create index if not exists assessment_responses_attempt_idx
  on public.assessment_responses (attempt_id);

drop trigger if exists set_assessment_definitions_updated_at on public.assessment_definitions;
create trigger set_assessment_definitions_updated_at
before update on public.assessment_definitions
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_items_updated_at on public.assessment_items;
create trigger set_assessment_items_updated_at
before update on public.assessment_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_attempts_updated_at on public.assessment_attempts;
create trigger set_assessment_attempts_updated_at
before update on public.assessment_attempts
for each row
execute function public.set_updated_at();

drop trigger if exists set_assessment_responses_updated_at on public.assessment_responses;
create trigger set_assessment_responses_updated_at
before update on public.assessment_responses
for each row
execute function public.set_updated_at();

alter table public.assessment_definitions enable row level security;
alter table public.assessment_items enable row level security;
alter table public.assessment_item_words enable row level security;
alter table public.assessment_assignments enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_responses enable row level security;

grant select, insert, update, delete on public.assessment_definitions to authenticated;
grant select, insert, update, delete on public.assessment_items to authenticated;
grant select, insert, update, delete on public.assessment_item_words to authenticated;
grant select, insert, update, delete on public.assessment_assignments to authenticated;
grant select, insert, update on public.assessment_attempts to authenticated;
grant select, insert, update on public.assessment_responses to authenticated;

grant all on public.assessment_definitions to service_role;
grant all on public.assessment_items to service_role;
grant all on public.assessment_item_words to service_role;
grant all on public.assessment_assignments to service_role;
grant all on public.assessment_attempts to service_role;
grant all on public.assessment_responses to service_role;

drop policy if exists "assessment_definitions_admin_all" on public.assessment_definitions;
create policy "assessment_definitions_admin_all"
on public.assessment_definitions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assessment_definitions_read_active" on public.assessment_definitions;
create policy "assessment_definitions_read_active"
on public.assessment_definitions
for select
to authenticated
using (public.is_admin() or active = true);

drop policy if exists "assessment_items_admin_all" on public.assessment_items;
create policy "assessment_items_admin_all"
on public.assessment_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assessment_item_words_admin_all" on public.assessment_item_words;
create policy "assessment_item_words_admin_all"
on public.assessment_item_words
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assessment_assignments_admin_all" on public.assessment_assignments;
create policy "assessment_assignments_admin_all"
on public.assessment_assignments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assessment_assignments_student_read" on public.assessment_assignments;
create policy "assessment_assignments_student_read"
on public.assessment_assignments
for select
to authenticated
using (
  public.is_admin()
  or public.is_parent_of_student(student_id)
);

drop policy if exists "assessment_attempts_admin_all" on public.assessment_attempts;
create policy "assessment_attempts_admin_all"
on public.assessment_attempts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assessment_attempts_student_read" on public.assessment_attempts;
create policy "assessment_attempts_student_read"
on public.assessment_attempts
for select
to authenticated
using (
  public.is_admin()
  or auth.uid() = user_id
  or public.is_parent_of_student(student_id)
);

drop policy if exists "assessment_attempts_student_insert" on public.assessment_attempts;
create policy "assessment_attempts_student_insert"
on public.assessment_attempts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_parent_of_student(student_id)
  and exists (
    select 1
    from public.assessment_definitions definition
    where definition.id = assessment_definition_id
      and definition.active = true
  )
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assessment_assignments assignment
      where assignment.id = assignment_id
        and assignment.student_id = student_id
        and assignment.assessment_definition_id = assessment_definition_id
        and assignment.status in ('assigned', 'in_progress', 'submitted')
        and (assignment.available_from is null or assignment.available_from <= now())
        and (assignment.due_at is null or assignment.due_at >= now())
    )
  )
);

drop policy if exists "assessment_attempts_student_update" on public.assessment_attempts;
create policy "assessment_attempts_student_update"
on public.assessment_attempts
for update
to authenticated
using (
  auth.uid() = user_id
  and public.is_parent_of_student(student_id)
)
with check (
  auth.uid() = user_id
  and public.is_parent_of_student(student_id)
  and exists (
    select 1
    from public.assessment_definitions definition
    where definition.id = assessment_definition_id
      and definition.active = true
  )
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assessment_assignments assignment
      where assignment.id = assignment_id
        and assignment.student_id = student_id
        and assignment.assessment_definition_id = assessment_definition_id
    )
  )
);

drop policy if exists "assessment_responses_admin_all" on public.assessment_responses;
create policy "assessment_responses_admin_all"
on public.assessment_responses
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assessment_responses_student_read" on public.assessment_responses;
create policy "assessment_responses_student_read"
on public.assessment_responses
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.assessment_attempts attempt
    where attempt.id = attempt_id
      and (
        attempt.user_id = auth.uid()
        or public.is_parent_of_student(attempt.student_id)
      )
  )
);

drop policy if exists "assessment_responses_student_insert" on public.assessment_responses;
create policy "assessment_responses_student_insert"
on public.assessment_responses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assessment_attempts attempt
    where attempt.id = attempt_id
      and attempt.user_id = auth.uid()
      and public.is_parent_of_student(attempt.student_id)
  )
  and exists (
    select 1
    from public.assessment_items item
    join public.assessment_attempts attempt
      on attempt.id = attempt_id
    where item.id = assessment_item_id
      and item.assessment_definition_id = attempt.assessment_definition_id
  )
);

drop policy if exists "assessment_responses_student_update" on public.assessment_responses;
create policy "assessment_responses_student_update"
on public.assessment_responses
for update
to authenticated
using (
  exists (
    select 1
    from public.assessment_attempts attempt
    where attempt.id = attempt_id
      and attempt.user_id = auth.uid()
      and public.is_parent_of_student(attempt.student_id)
  )
)
with check (
  exists (
    select 1
    from public.assessment_attempts attempt
    where attempt.id = attempt_id
      and attempt.user_id = auth.uid()
      and public.is_parent_of_student(attempt.student_id)
  )
  and exists (
    select 1
    from public.assessment_items item
    join public.assessment_attempts attempt
      on attempt.id = attempt_id
    where item.id = assessment_item_id
      and item.assessment_definition_id = attempt.assessment_definition_id
  )
);
