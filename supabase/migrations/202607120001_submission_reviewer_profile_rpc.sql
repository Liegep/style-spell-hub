drop function if exists public.get_submission_reviewer_profile(uuid);

create function public.get_submission_reviewer_profile(submission_lookup uuid)
returns table (
  id uuid,
  display_name text,
  full_name text,
  email text,
  avatar_url text,
  status_message text,
  availability_status public.availability_status
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.blog_submissions s
    where s.id = submission_lookup
      and (s.blogger_id = auth.uid() or public.is_staff())
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.full_name,
    p.email,
    p.avatar_url,
    p.status_message,
    p.availability_status
  from public.blog_submissions s
  join public.profiles p on p.id = s.reviewed_by
  where s.id = submission_lookup
  limit 1;
end;
$$;

revoke all on function public.get_submission_reviewer_profile(uuid) from public;
grant execute on function public.get_submission_reviewer_profile(uuid) to authenticated;
