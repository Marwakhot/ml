-- AI Research Lab schema
-- Run this in the Supabase SQL editor (or `supabase db push`) for a fresh project.
--
-- No auth/RLS lockdown by design: this app has no user accounts (single
-- session / anonymous use per the project's non-goals), so both tables are
-- readable/writable by the anon key. Do not put sensitive data in this
-- project's datasets.

create extension if not exists "pgcrypto";

create table if not exists datasets (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  blob_url text not null,
  row_count integer not null,
  columns jsonb not null,
  target_column text,
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  model_type text not null,
  config jsonb not null default '{}'::jsonb,
  accuracy double precision not null,
  precision double precision not null,
  recall double precision not null,
  f1 double precision not null,
  training_time_ms integer not null,
  inference_time_ms integer not null,
  created_at timestamptz not null default now()
);

create index if not exists runs_dataset_id_idx on runs(dataset_id);
create index if not exists runs_model_type_idx on runs(model_type);

alter table datasets enable row level security;
alter table runs enable row level security;

-- Open policies: anonymous demo app, no auth. Tighten if you add accounts.
create policy "datasets_anon_all" on datasets
  for all using (true) with check (true);

create policy "runs_anon_all" on runs
  for all using (true) with check (true);

-- Storage bucket for CSV files
insert into storage.buckets (id, name, public) 
values ('datasets', 'datasets', true)
on conflict (id) do nothing;

create policy "Allow public uploads to datasets bucket" 
on storage.objects for insert 
with check (bucket_id = 'datasets');

create policy "Allow public reads from datasets bucket" 
on storage.objects for select 
using (bucket_id = 'datasets');

create policy "Allow public deletes from datasets bucket"
on storage.objects for delete
using (bucket_id = 'datasets');
