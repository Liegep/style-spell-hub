# Love Potion Platform Implementation Plan

Pinned roadmap for building the blogger management platform without breaking the visual foundation.

## 1. Data Model + Permissions

- Status: in progress, schema drafted in `supabase/migrations/202605300001_core_schema.sql`.
- Define the Supabase tables:
  - `profiles`
  - `product_releases`
  - `product_claims`
  - `blog_submissions`
  - `blog_submission_links`
  - `internal_messages`
- Added support tables:
  - `blogger_applications`
  - `newsletter_subscribers`
- Defined RLS policies for blogger, admin, and super admin access.
- Defined storage buckets and policies for avatars, product images, and content assets.

## 2. Real Auth + Roles

- Make the app understand the real logged-in user.
- Route users based on role:
  - `blogger`
  - `admin`
  - `super_admin`
- Hide or show pages and actions based on permissions.
- Remove preview-only role behavior when the real role system is ready.

## 3. Blogger Products

- Load real available products from Supabase.
- Open the product dossier modal from the product card.
- Show:
  - deadline
  - product recommendations
  - Second Life location
  - vendor poster download
  - product details
- Prepare the claim flow for Second Life delivery.

## 4. Submit Links

- Connect the product modal submit form to Supabase.
- Save:
  - product id
  - blogger id
  - links
  - platform type
  - optional notes
  - submission status
- Allow multiple links in one submission.

## 5. Admin + Super Admin Review

- Show pending submissions first.
- Let admins open submitted links.
- Allow review actions:
  - approve
  - reject
  - request revision
- Save review comments so bloggers can see the feedback.

## 6. Content Studio

- Super admin can create and edit product releases.
- Upload and manage:
  - editorial image
  - vendor poster
  - landing page image
  - login/hero/content assets
- Configure:
  - release status
  - landing visibility
  - display order
  - deadline
  - auto-archive date
  - Second Life delivery key

## 7. Automations

- Enforce one post per month.
- Block blogger accounts that miss the monthly requirement.
- Auto-archive products after 90 days.
- Warn about products close to archive.
- Warn bloggers about deadlines and pending posts.
