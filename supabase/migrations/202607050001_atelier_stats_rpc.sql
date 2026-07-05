create or replace function public.get_atelier_stats()
returns table (
  active_bloggers integer,
  inactive_bloggers integer,
  posts_this_month integer,
  products_live integer,
  archive_soon integer,
  subscribers integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    (
      select count(*)::integer
      from public.profiles
      where role = 'blogger'
        and account_status = 'active'
    ) as active_bloggers,
    (
      select count(*)::integer
      from public.profiles
      where role = 'blogger'
        and account_status <> 'active'
    ) as inactive_bloggers,
    (
      select count(*)::integer
      from public.blog_submissions
      where submitted_at >= date_trunc('month', now())
    ) as posts_this_month,
    (
      select count(*)::integer
      from public.product_releases
      where status = 'available'
    ) as products_live,
    (
      select count(*)::integer
      from public.product_releases
      where status = 'available'
        and auto_archive_at is not null
        and auto_archive_at <= now() + interval '30 days'
    ) as archive_soon,
    (
      select count(*)::integer
      from public.newsletter_subscribers
      where is_active = true
        and unsubscribed_at is null
    ) as subscribers;
end;
$$;

revoke all on function public.get_atelier_stats() from public;
grant execute on function public.get_atelier_stats() to authenticated;
