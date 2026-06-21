create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.site_content (
  key text not null,
  language text not null check (language in ('en', 'es')),
  label text not null,
  value text not null,
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (key, language)
);

alter table public.site_content enable row level security;

drop trigger if exists touch_site_content_updated_at on public.site_content;
create trigger touch_site_content_updated_at
before update on public.site_content
for each row execute function public.touch_updated_at();

drop policy if exists "Anyone can read site content" on public.site_content;
create policy "Anyone can read site content"
on public.site_content for select
to anon, authenticated
using (true);

drop policy if exists "Staff can manage site content" on public.site_content;
create policy "Staff can manage site content"
on public.site_content for all
to authenticated
using (public.is_staff())
with check (public.is_staff());
