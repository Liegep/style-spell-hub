-- Internal mailbox: personal messages and broadcasts.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
      and p.account_status = 'active'
  );
$$;

create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('personal', 'broadcast')),
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete cascade,
  subject text not null,
  body text,
  image_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint internal_messages_personal_recipient_check
    check (
      (scope = 'personal' and recipient_id is not null)
      or (scope = 'broadcast' and recipient_id is null)
    )
);

alter table public.internal_messages enable row level security;

drop policy if exists "staff can read all internal messages" on public.internal_messages;
create policy "staff can read all internal messages"
on public.internal_messages
for select
using (public.is_staff());

drop policy if exists "bloggers can read their mailbox" on public.internal_messages;
create policy "bloggers can read their mailbox"
on public.internal_messages
for select
using (
  auth.role() = 'authenticated'
  and (
    scope = 'broadcast'
    or recipient_id = auth.uid()
  )
);

drop policy if exists "staff can send internal messages" on public.internal_messages;
create policy "staff can send internal messages"
on public.internal_messages
for insert
with check (
  public.is_staff()
  and sender_id = auth.uid()
);

drop policy if exists "staff can update internal messages" on public.internal_messages;
create policy "staff can update internal messages"
on public.internal_messages
for update
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "staff can delete internal messages" on public.internal_messages;
create policy "staff can delete internal messages"
on public.internal_messages
for delete
using (public.is_staff());

create index if not exists internal_messages_recipient_idx
on public.internal_messages (recipient_id, created_at desc);

create index if not exists internal_messages_sender_idx
on public.internal_messages (sender_id, created_at desc);
