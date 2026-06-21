-- 01 - Warning notification setup.
-- Replace PASTE_NOTIFICATION_CRON_SECRET_HERE with the same value used in
-- the Edge Function secret NOTIFICATION_CRON_SECRET.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on private.app_secrets from public;
revoke all on private.app_secrets from anon;
revoke all on private.app_secrets from authenticated;

insert into private.app_secrets (key, value)
values ('notification_cron_secret', 'PASTE_NOTIFICATION_CRON_SECRET_HERE')
on conflict (key) do update
set
  value = excluded.value,
  updated_at = now();

create unique index if not exists notification_queue_warning_key_uidx
  on public.notification_queue ((metadata->>'warning_key'))
  where metadata ? 'warning_key';
