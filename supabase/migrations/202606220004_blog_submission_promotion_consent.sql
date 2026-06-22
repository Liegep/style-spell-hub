alter table public.blog_submissions
  add column if not exists promotion_consent boolean not null default false;
