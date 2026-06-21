-- Dynamic blogger application form builder.
-- Staff can design/publish the form. Visitors can read enabled fields and submit applications.

create table if not exists public.application_form_fields (
  id uuid primary key default gen_random_uuid(),
  field_key text not null unique,
  label text not null,
  field_type text not null check (
    field_type in ('short_text', 'long_text', 'email', 'url', 'select', 'checkbox', 'date')
  ),
  placeholder text,
  help_text text,
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_form_fields enable row level security;

drop policy if exists "Anyone can read enabled application form fields" on public.application_form_fields;
drop policy if exists "Staff can read application form fields" on public.application_form_fields;
drop policy if exists "Staff can manage application form fields" on public.application_form_fields;

create policy "Anyone can read enabled application form fields"
on public.application_form_fields
for select
to anon, authenticated
using (enabled = true);

create policy "Staff can read application form fields"
on public.application_form_fields
for select
to authenticated
using (public.is_staff());

create policy "Staff can manage application form fields"
on public.application_form_fields
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop trigger if exists touch_application_form_fields_updated_at on public.application_form_fields;
create trigger touch_application_form_fields_updated_at
before update on public.application_form_fields
for each row execute function public.touch_updated_at();

insert into public.application_form_fields (
  field_key,
  label,
  field_type,
  placeholder,
  help_text,
  options,
  required,
  enabled,
  sort_order
)
values
  ('displayName', 'Display name', 'short_text', 'Aria Solstice', null, '[]'::jsonb, true, true, 10),
  ('slAvatarName', 'Second Life avatar name', 'short_text', 'Resident.Lastname', null, '[]'::jsonb, true, true, 20),
  ('email', 'Email', 'email', 'you@email.com', null, '[]'::jsonb, true, true, 30),
  ('flickrUrl', 'Flickr URL', 'url', 'https://flickr.com/you', null, '[]'::jsonb, false, true, 40),
  ('instagramUrl', 'Instagram / social handle', 'short_text', '@yourhandle', null, '[]'::jsonb, false, true, 50),
  ('blogUrl', 'Blog / Primfeed', 'url', 'https://primfeed.com/you', null, '[]'::jsonb, false, true, 60),
  ('languages', 'Languages', 'short_text', 'EN, ES, FR...', null, '[]'::jsonb, false, true, 70),
  ('hours', 'Hours per week', 'select', null, null, '["1-5 / week", "5-10 / week", "10-20 / week", "20+ / week"]'::jsonb, false, true, 80),
  ('cameraStyle', 'Camera & style', 'long_text', 'Firestorm, Black Dragon, no edit, heavy edit...', null, '[]'::jsonb, false, true, 90),
  ('whyLovePotion', 'Why Love Potion?', 'long_text', 'Tell us in your own voice.', null, '[]'::jsonb, false, true, 100)
on conflict (field_key) do update
set
  label = excluded.label,
  field_type = excluded.field_type,
  placeholder = excluded.placeholder,
  help_text = excluded.help_text,
  options = excluded.options,
  required = excluded.required,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order;
