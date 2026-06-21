create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.site_assets (
  key text primary key,
  label text not null,
  description text,
  image_url text not null,
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_assets enable row level security;

drop trigger if exists set_site_assets_updated_at on public.site_assets;
create trigger set_site_assets_updated_at
before update on public.site_assets
for each row execute function public.touch_updated_at();

drop policy if exists "Anyone can read site assets" on public.site_assets;
create policy "Anyone can read site assets"
on public.site_assets for select
to anon, authenticated
using (true);

drop policy if exists "Staff can manage site assets" on public.site_assets;
create policy "Staff can manage site assets"
on public.site_assets for all
to authenticated
using (public.is_staff())
with check (public.is_staff());
