update public.product_releases
set
  auto_archive_at = now() + interval '90 days',
  updated_at = now()
where status = 'available'
  and (
    auto_archive_at is null
    or auto_archive_at <= now()
  );
