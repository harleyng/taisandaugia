create table public.partnership_registrations (
  id           uuid primary key default gen_random_uuid(),
  org_name     text not null,
  contact_name text not null,
  phone        text not null,
  email        text not null,
  province     text not null,
  note         text,
  status       text not null default 'NEW',
  created_at   timestamptz not null default now()
);

alter table public.partnership_registrations enable row level security;

create policy "anyone can submit"
  on public.partnership_registrations
  for insert
  with check (true);

create policy "service role can select"
  on public.partnership_registrations
  for select
  using (true);

create policy "service role can update"
  on public.partnership_registrations
  for update
  using (true)
  with check (true);
