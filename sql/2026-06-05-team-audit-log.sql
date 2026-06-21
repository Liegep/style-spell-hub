create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_role public.app_role,
  action text not null,
  target_type text,
  target_id text,
  target_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_actor_created_at_idx
  on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "Staff can read audit logs" on public.audit_logs;
create policy "Staff can read audit logs"
  on public.audit_logs for select
  using (public.is_staff());

drop policy if exists "Authenticated users can create audit logs" on public.audit_logs;
create policy "Authenticated users can create audit logs"
  on public.audit_logs for insert
  with check (actor_id = auth.uid());

grant select, insert on public.audit_logs to authenticated;
