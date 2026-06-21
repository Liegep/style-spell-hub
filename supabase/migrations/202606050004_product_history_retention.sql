-- Product history retention for Love Potion.
-- Keeps product releases, but removes old operational history for archived products.
-- This cleans claims, delivery responses, blog submissions, and submission links
-- after the product has been archived long enough.

create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_old_product_history(
  retention interval default interval '90 days'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.blog_submissions bs
  using public.product_releases pr
  where bs.product_id = pr.id
    and pr.status = 'archived'
    and coalesce(pr.auto_archive_at, pr.updated_at, pr.created_at) < now() - retention;

  delete from public.product_claims pc
  using public.product_releases pr
  where pc.product_id = pr.id
    and pr.status = 'archived'
    and coalesce(pr.auto_archive_at, pr.updated_at, pr.created_at) < now() - retention;
end;
$$;

revoke all on function public.cleanup_old_product_history(interval) from public;
grant execute on function public.cleanup_old_product_history(interval) to service_role;

do $$
declare
  existing_jobid bigint;
begin
  select jobid
  into existing_jobid
  from cron.job
  where jobname = 'cleanup-old-product-history'
  limit 1;

  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end $$;

select cron.schedule(
  'cleanup-old-product-history',
  '45 4 * * *',
  $$select public.cleanup_old_product_history(interval '90 days');$$
);

