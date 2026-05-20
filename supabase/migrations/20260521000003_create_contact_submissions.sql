create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  subject text,
  message text not null,
  status text not null default 'unread',
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

create policy "Anyone can submit"
  on public.contact_submissions for insert
  with check (true);

create policy "Admins can view"
  on public.contact_submissions for select
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'ADMIN'
    )
  );

create policy "Admins can update"
  on public.contact_submissions for update
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'ADMIN'
    )
  );
