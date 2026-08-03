-- ============================================================
-- Civitas — Complete database setup (idempotent)
-- Creates the current schema matching lib/types.ts Profile +
-- eligibility_results, documents, benefit_progress,
-- ui_translations, extension_pairings, language_change_log,
-- and the private user-documents storage bucket.
--
-- Apply with:
--   supabase db query --linked -f supabase/setup.sql
-- or paste into the Supabase SQL Editor.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLE: profiles
-- ============================================================
create table if not exists public.profiles (
  id                              uuid primary key references auth.users(id) on delete cascade,
  email                           text,
  language_code                   text not null default 'en',

  -- Immigration / Identity
  immigration_status              text,
  has_i94                         boolean,
  has_ead                         boolean,
  has_ssn                         boolean,
  has_orr_eligibility_letter      boolean,

  -- Key Dates
  eligibility_date                date,
  arrival_date                    date,
  status_grant_date               date,

  -- Location
  state                           text,
  city                            text,
  zip_code                        text,

  -- Household / Income
  age                             integer,
  household_size                  integer,
  household_gross_monthly_income  numeric,
  num_children_under_19           integer default 0,
  num_children_under_18           integer default 0,
  num_children_under_5            integer default 0,
  is_pregnant                     boolean default false,
  receives_other_cash_benefit     boolean default false,

  -- Special Circumstances
  is_unaccompanied_minor          boolean default false,
  is_disabled                     boolean default false,
  is_blind                        boolean default false,
  has_40_work_quarters            boolean default false,

  -- Goals / Services
  is_employed_or_seeking          boolean default false,
  wants_to_start_business         boolean default false,
  wants_english_classes           boolean default false,
  needs_interpreter               boolean default false,

  -- Meta
  onboarding_complete             boolean default false,
  created_at                      timestamptz default now(),
  updated_at                      timestamptz default now()
);

-- Ensure columns exist even if an older profiles table is already present
alter table public.profiles
  add column if not exists language_code text not null default 'en',
  add column if not exists immigration_status text,
  add column if not exists has_i94 boolean,
  add column if not exists has_ead boolean,
  add column if not exists has_ssn boolean,
  add column if not exists has_orr_eligibility_letter boolean,
  add column if not exists eligibility_date date,
  add column if not exists arrival_date date,
  add column if not exists status_grant_date date,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists zip_code text,
  add column if not exists age integer,
  add column if not exists household_size integer,
  add column if not exists household_gross_monthly_income numeric,
  add column if not exists num_children_under_19 integer default 0,
  add column if not exists num_children_under_18 integer default 0,
  add column if not exists num_children_under_5 integer default 0,
  add column if not exists is_pregnant boolean default false,
  add column if not exists receives_other_cash_benefit boolean default false,
  add column if not exists is_unaccompanied_minor boolean default false,
  add column if not exists is_disabled boolean default false,
  add column if not exists is_blind boolean default false,
  add column if not exists has_40_work_quarters boolean default false,
  add column if not exists is_employed_or_seeking boolean default false,
  add column if not exists wants_to_start_business boolean default false,
  add column if not exists wants_english_classes boolean default false,
  add column if not exists needs_interpreter boolean default false,
  add column if not exists onboarding_complete boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for any existing auth users
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ============================================================
-- TABLE: eligibility_results
-- ============================================================
create table if not exists public.eligibility_results (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  generated_at        timestamptz default now(),
  language            text not null default 'en',
  rules_last_checked  date,
  summary             text,
  attorney_needed     boolean default false,
  benefits            jsonb not null default '[]'::jsonb,
  flagged_for_human   jsonb not null default '[]'::jsonb,
  created_at          timestamptz default now()
);

create index if not exists idx_eligibility_results_user_id on public.eligibility_results(user_id);
create index if not exists idx_eligibility_results_generated_at on public.eligibility_results(generated_at desc);

alter table public.eligibility_results enable row level security;

drop policy if exists "Users can view their own eligibility results" on public.eligibility_results;
drop policy if exists "Service role can insert eligibility results" on public.eligibility_results;
drop policy if exists "Service role can update eligibility results" on public.eligibility_results;

create policy "Users can view their own eligibility results"
  on public.eligibility_results for select
  using (auth.uid() = user_id);

create policy "Service role can insert eligibility results"
  on public.eligibility_results for insert
  with check (auth.uid() = user_id);

create policy "Service role can update eligibility results"
  on public.eligibility_results for update
  using (auth.uid() = user_id);

-- ============================================================
-- TABLE: documents
-- ============================================================
create table if not exists public.documents (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  file_name         text not null,
  file_path         text not null,
  file_size         integer,
  mime_type         text,
  document_type     text,
  extracted_fields  jsonb,
  uploaded_at       timestamptz default now()
);

create index if not exists idx_documents_user_id on public.documents(user_id);

alter table public.documents enable row level security;

drop policy if exists "Users can view their own documents" on public.documents;
drop policy if exists "Users can insert their own documents" on public.documents;
drop policy if exists "Users can delete their own documents" on public.documents;

create policy "Users can view their own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- ============================================================
-- TABLE: benefit_progress
-- ============================================================
create table if not exists public.benefit_progress (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  benefit_id    text not null,
  benefit_name  text not null,
  status        text not null default 'not_started'
                  check (status in (
                    'not_started',
                    'in_progress',
                    'documents_ready',
                    'submitted',
                    'needs_attorney',
                    'done'
                  )),
  notes         text,
  updated_at    timestamptz default now(),
  created_at    timestamptz default now(),
  unique(user_id, benefit_id)
);

create index if not exists idx_benefit_progress_user_id on public.benefit_progress(user_id);

alter table public.benefit_progress enable row level security;

drop policy if exists "Users can view their own benefit progress" on public.benefit_progress;
drop policy if exists "Users can insert their own benefit progress" on public.benefit_progress;
drop policy if exists "Users can update their own benefit progress" on public.benefit_progress;

create policy "Users can view their own benefit progress"
  on public.benefit_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own benefit progress"
  on public.benefit_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own benefit progress"
  on public.benefit_progress for update
  using (auth.uid() = user_id);

-- ============================================================
-- TABLE: ui_translations
-- ============================================================
create table if not exists public.ui_translations (
  id              uuid primary key default uuid_generate_v4(),
  language_code   text not null unique,
  language_name   text,
  translations    jsonb not null,
  generated_at    timestamptz default now()
);

alter table public.ui_translations enable row level security;

drop policy if exists "Any authenticated user can read translations" on public.ui_translations;

create policy "Any authenticated user can read translations"
  on public.ui_translations for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

-- ============================================================
-- TABLE: extension_pairings (migration v3)
-- ============================================================
create table if not exists public.extension_pairings (
  code        text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz default now()
);

alter table public.extension_pairings enable row level security;

drop policy if exists "users own pairings" on public.extension_pairings;

create policy "users own pairings" on public.extension_pairings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- TABLE: language_change_log (migration v3)
-- ============================================================
create table if not exists public.language_change_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  changed_to text not null,
  changed_at timestamptz default now()
);

create index if not exists language_change_log_user_time
  on public.language_change_log(user_id, changed_at desc);

alter table public.language_change_log enable row level security;

drop policy if exists "users own log" on public.language_change_log;

create policy "users own log" on public.language_change_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET: user-documents
-- ============================================================
insert into storage.buckets (id, name, public)
values ('user-documents', 'user-documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own documents" on storage.objects;
drop policy if exists "Users can view their own documents" on storage.objects;
drop policy if exists "Users can delete their own documents" on storage.objects;

create policy "Users can upload their own documents"
  on storage.objects for insert
  with check (
    bucket_id = 'user-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own documents"
  on storage.objects for select
  using (
    bucket_id = 'user-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own documents"
  on storage.objects for delete
  using (
    bucket_id = 'user-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- HELPER: updated_at auto-refresh
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_benefit_progress_updated_at on public.benefit_progress;
create trigger set_benefit_progress_updated_at
  before update on public.benefit_progress
  for each row execute procedure public.set_updated_at();
