-- Love Potion core platform schema
-- Run this in Supabase SQL Editor or with Supabase CLI.

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('blogger', 'admin', 'super_admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.account_status as enum ('pending', 'active', 'blocked', 'left');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.availability_status as enum ('available', 'vacation', 'busy', 'offline');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.product_status as enum ('draft', 'available', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.claim_status as enum ('claimed', 'delivered', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.submission_status as enum ('pending', 'approved', 'rejected', 'needs_revision');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.message_scope as enum ('personal', 'broadcast');
exception
  when duplicate_object then null;
end $$;
