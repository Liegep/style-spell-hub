-- Auto-register the current Second Life delivery URL after region/script restarts.

create table if not exists public.second_life_delivery_servers (
  id text primary key default 'primary',
  server_url text not null,
  object_name text,
  object_key text,
  region_name text,
  owner_key text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists second_life_delivery_servers_active_idx
  on public.second_life_delivery_servers(active, last_seen_at desc);

drop trigger if exists touch_second_life_delivery_servers_updated_at on public.second_life_delivery_servers;
create trigger touch_second_life_delivery_servers_updated_at
before update on public.second_life_delivery_servers
for each row execute function public.touch_updated_at();

alter table public.second_life_delivery_servers enable row level security;

-- No public policies are needed. The Edge Functions use the service role key.
