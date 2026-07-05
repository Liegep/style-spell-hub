alter table public.product_releases
  add column if not exists demo_item_key text;

comment on column public.product_releases.demo_item_key is
  'Second Life inventory item or folder name used for demo delivery. Demo deliveries do not create product claims or count toward quota.';
