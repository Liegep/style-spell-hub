# Supabase Setup

This folder keeps the database foundation for the Love Potion blogger platform.

## Migration Order

Run the migrations in this order:

1. `migrations/202605300001_core_schema.sql`

You can paste the migration into the Supabase SQL Editor, or later run it with the Supabase CLI.

If the Supabase SQL Editor truncates a large paste, run the smaller files in `sql-editor-chunks` in numerical order:

1. `sql-editor-chunks/01_enums.sql`
2. `sql-editor-chunks/02_core_tables.sql`
3. `sql-editor-chunks/03_support_tables_triggers_indexes.sql`
4. `sql-editor-chunks/04_role_functions.sql`
5. `sql-editor-chunks/05_rls_profiles_releases_claims.sql`
6. `sql-editor-chunks/06_rls_submissions_messages.sql`
7. `sql-editor-chunks/07_rls_applications_newsletter_buckets.sql`
8. `sql-editor-chunks/08_storage_policies.sql`

## Buckets Created

- `avatars` — profile photos
- `product-images` — product editorial images and vendor posters
- `content-assets` — landing/login/about/content images

All buckets are public for read access. Upload and management permissions are controlled by storage policies.

## Frontend Environment

Create a local `.env.local` file at the project root before testing real login:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

Use the **anon public** key from Supabase Project Settings > API. Never put the `service_role` key in the frontend.

## First Super Admin

After creating your user in Supabase Auth, run this once from the SQL Editor to promote your account.

Replace the email with your real login email:

```sql
update public.profiles
set
  role = 'super_admin',
  account_status = 'active',
  display_name = coalesce(display_name, 'Marie Whitfield')
where email = 'YOUR_EMAIL_HERE';
```

If the profile row does not exist yet, insert it manually:

```sql
insert into public.profiles (
  id,
  email,
  display_name,
  role,
  account_status,
  language_preference
)
select
  id,
  email,
  'Marie Whitfield',
  'super_admin',
  'active',
  'en'
from auth.users
where email = 'YOUR_EMAIL_HERE'
on conflict (id) do update
set
  role = 'super_admin',
  account_status = 'active';
```

## Access Rules Summary

- Bloggers can read available products.
- Bloggers can claim available products for themselves.
- Bloggers can create and edit their own pending submissions.
- Admins and super admins can review submissions.
- Only super admins can create, update, archive, and delete product releases.
- Only staff can create internal messages.
- Public visitors can submit applications and subscribe to the newsletter.

## Design Note

The schema preserves the current visual design by supporting separate fields for:

- editorial image shown on landing/cards
- vendor poster downloaded by bloggers
- handwritten landing note
- blogging recommendations shown inside the blogger modal
