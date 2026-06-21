-- Reset Notifications + Atelier activity.
-- IMPORTANT:
-- 1. Run sql/2026-06-18-reset-notifications-atelier-preview.sql first.
-- 2. Run this only when the preview looks correct.
--
-- This keeps:
-- - auth users and profiles
-- - product releases
-- - site assets and site content
-- - newsletter subscribers
-- - applications
--
-- This clears:
-- - Notifications queue / in-app notifications / SL notification history
-- - internal messages
-- - audit log
-- - blogger product claims
-- - blog submissions and submission links

begin;

delete from public.blog_submission_links;
delete from public.blog_submissions;
delete from public.product_claims;
delete from public.notification_queue;
delete from public.internal_messages;
delete from public.audit_logs;

commit;
