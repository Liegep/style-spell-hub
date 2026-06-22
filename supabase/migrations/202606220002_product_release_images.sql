create table if not exists public.product_release_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.product_releases(id) on delete cascade,
  image_url text not null,
  alt_text text,
  is_cover boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_release_images_product_idx
  on public.product_release_images(product_id, sort_order, created_at);

create unique index if not exists product_release_images_one_cover_idx
  on public.product_release_images(product_id)
  where is_cover;

alter table public.product_release_images enable row level security;

drop policy if exists "Anyone can read available product images" on public.product_release_images;
create policy "Anyone can read available product images"
on public.product_release_images for select
to anon, authenticated
using (
  exists (
    select 1
    from public.product_releases pr
    where pr.id = product_id
      and (pr.status = 'available' or public.is_staff())
  )
);

drop policy if exists "Super admins manage product images" on public.product_release_images;
create policy "Super admins manage product images"
on public.product_release_images for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
