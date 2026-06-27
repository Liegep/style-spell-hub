-- Safe RPC for toggling blogger admissions.
-- This avoids relying on client-side upserts against RLS-protected settings rows.

create or replace function public.set_blogger_admissions_open(next_open boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can update blogger admissions';
  end if;

  insert into public.application_settings (key, value)
  values ('blogger_admissions', jsonb_build_object('open', coalesce(next_open, true)))
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();

  return jsonb_build_object('open', coalesce(next_open, true));
end;
$$;

revoke all on function public.set_blogger_admissions_open(boolean) from public;
grant execute on function public.set_blogger_admissions_open(boolean) to authenticated;
