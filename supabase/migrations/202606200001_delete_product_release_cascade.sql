create or replace function public.delete_product_release_cascade(target_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_app_role() <> 'super_admin' then
    raise exception 'Only super admins can delete product releases.';
  end if;

  delete from public.blog_submission_links bsl
  using public.blog_submissions bs
  where bsl.submission_id = bs.id
    and bs.product_id = target_product_id;

  delete from public.blog_submissions
  where product_id = target_product_id;

  delete from public.product_claims
  where product_id = target_product_id;

  delete from public.product_releases
  where id = target_product_id;
end;
$$;

revoke all on function public.delete_product_release_cascade(uuid) from public;
grant execute on function public.delete_product_release_cascade(uuid) to authenticated;
