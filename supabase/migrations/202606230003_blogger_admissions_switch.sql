-- Blogger admissions switch.
-- Staff can open/close the public application page without redeploying.

create table if not exists public.application_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_settings enable row level security;

drop policy if exists "Anyone can read application settings" on public.application_settings;
drop policy if exists "Staff can manage application settings" on public.application_settings;

create policy "Anyone can read application settings"
on public.application_settings
for select
to anon, authenticated
using (true);

create policy "Staff can manage application settings"
on public.application_settings
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop trigger if exists touch_application_settings_updated_at on public.application_settings;
create trigger touch_application_settings_updated_at
before update on public.application_settings
for each row execute function public.touch_updated_at();

insert into public.application_settings (key, value)
values ('blogger_admissions', '{"open": true}'::jsonb)
on conflict (key) do nothing;
