drop policy if exists "Submissions visible to owner and staff" on public.blog_submissions;
create policy "Submissions visible to owner and staff"
on public.blog_submissions for select
to authenticated
using (blogger_id = auth.uid() or public.is_staff());

drop policy if exists "Bloggers create their own submissions" on public.blog_submissions;
create policy "Bloggers create their own submissions"
on public.blog_submissions for insert
to authenticated
with check (blogger_id = auth.uid());

drop policy if exists "Bloggers update pending own submissions" on public.blog_submissions;
create policy "Bloggers update pending own submissions"
on public.blog_submissions for update
to authenticated
using (blogger_id = auth.uid() and status in ('pending', 'needs_revision'))
with check (blogger_id = auth.uid() and status in ('pending', 'needs_revision'));

drop policy if exists "Staff review submissions" on public.blog_submissions;
create policy "Staff review submissions"
on public.blog_submissions for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Submission links visible to owner and staff" on public.blog_submission_links;
create policy "Submission links visible to owner and staff"
on public.blog_submission_links for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.blog_submissions bs
    where bs.id = submission_id
      and bs.blogger_id = auth.uid()
  )
);

drop policy if exists "Bloggers manage own submission links" on public.blog_submission_links;
create policy "Bloggers manage own submission links"
on public.blog_submission_links for all
to authenticated
using (
  exists (
    select 1
    from public.blog_submissions bs
    where bs.id = submission_id
      and bs.blogger_id = auth.uid()
      and bs.status in ('pending', 'needs_revision')
  )
)
with check (
  exists (
    select 1
    from public.blog_submissions bs
    where bs.id = submission_id
      and bs.blogger_id = auth.uid()
      and bs.status in ('pending', 'needs_revision')
  )
);

drop policy if exists "Staff manage submission links" on public.blog_submission_links;
create policy "Staff manage submission links"
on public.blog_submission_links for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Messages visible to recipient broadcast and staff" on public.internal_messages;
create policy "Messages visible to recipient broadcast and staff"
on public.internal_messages for select
to authenticated
using (scope = 'broadcast' or recipient_id = auth.uid() or sender_id = auth.uid() or public.is_staff());

drop policy if exists "Staff create messages" on public.internal_messages;
create policy "Staff create messages"
on public.internal_messages for insert
to authenticated
with check (public.is_staff());

drop policy if exists "Users mark own messages read" on public.internal_messages;
create policy "Users mark own messages read"
on public.internal_messages for update
to authenticated
using (recipient_id = auth.uid() or public.is_staff())
with check (recipient_id = auth.uid() or public.is_staff());
