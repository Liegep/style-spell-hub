# Integration Points — Where to Connect Backend

> This file maps every mock data usage in the codebase to the real backend feature it should replace.

## 1. Authentication & User Management

### Current State
- Login page (`src/routes/$lang.login.tsx`) has a styled form but no real auth
- All `/app/*` routes are unprotected (no auth check)

### Integration Points

| Location | What to Replace | Backend Feature |
|----------|----------------|-----------------|
| `$lang.login.tsx` | Form submission | Sign in with email/password (Supabase Auth) |
| `app.tsx` | No auth gate | Auth middleware / protected route layout |
| `app.admin.tsx` | Static admin access | Role check (admin role from DB) |
| `app.super-admin.tsx` | Static super access | Role check (super-admin role from DB) |
| `app.blogger.tsx` | Static blogger access | Role check (blogger role from DB) |

### Recommended Flow
1. Supabase Auth for email/password login
2. `user_roles` table with roles: `blogger`, `admin`, `super_admin`
3. `requireSupabaseAuth` middleware on server functions
4. Route guards in app layout based on role

---

## 2. Bloggers

### Current State
- Data: `bloggers` array in `src/mocks/data.ts`
- Used in: `app.admin.tsx`, `app.super-admin.tsx`

### Integration Points

| Location | What to Replace | Backend Feature |
|----------|----------------|-----------------|
| `app.admin.tsx` → Bloggers tab | `bloggers` array | `SELECT * FROM bloggers` with status filter |
| `app.super-admin.tsx` → Stats card | `stats.activeBloggers` | `COUNT(*) FROM bloggers WHERE status = 'active'` |
| `app.super-admin.tsx` → Roster list | `bloggers` array | `SELECT name, status, posts, last, lang, frequency FROM bloggers` |
| `app.blogger.tsx` | Hardcoded "Marie" profile | `SELECT * FROM bloggers WHERE user_id = auth.uid()` |

### Blogger Profile Fields (for `app.blogger.tsx`)
The blogger dashboard needs these editable fields:
- `display_name` — shown on profile card
- `avatar_url` — profile photo (file upload → storage)
- `bio` — short text, max ~100 chars (2 lines)
- `status` — enum: `active`, `on_vacation`, `busy`, `inactive`
- `custom_message` — personal note shown over avatar (max 60 chars, 2 lines)
- `frequency` — posting frequency label

---

## 3. Products / Releases

### Current State
- Data: `releases` and `products` arrays in `src/mocks/data.ts`
- Used in: `$lang.releases.tsx`, `app.admin.tsx`

### Integration Points

| Location | What to Replace | Backend Feature |
|----------|----------------|-----------------|
| `$lang.releases.tsx` | `releases` array | `SELECT * FROM products WHERE status = 'live' ORDER BY date DESC` |
| `app.admin.tsx` → Products tab | `products` array | `SELECT * FROM products` with expiry calculation |
| `app.super-admin.tsx` → Stats | `stats.productsLive`, `stats.archiveSoon` | Aggregated counts from products table |
| `app.blogger.tsx` → Available Products | Static list | `SELECT * FROM products WHERE status = 'live'` that blogger hasn't claimed |

### Product Schema
```sql
products (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  category text,
  img_url text,
  date date,
  note text,
  status text, -- 'live', 'archived', 'draft'
  claims_count int DEFAULT 0,
  expires_at timestamp
)
```

---

## 4. Messages

### Current State
- Data: `messages` array in `src/mocks/data.ts`
- Used in: `app.admin.tsx`

### Integration Points

| Location | What to Replace | Backend Feature |
|----------|----------------|-----------------|
| `app.admin.tsx` → Messages tab | `messages` array | `SELECT * FROM messages WHERE to_user_id = auth.uid() OR type = 'broadcast'` |
| `app.blogger.tsx` | Static message | `SELECT * FROM messages WHERE to_user_id = auth.uid()` |

### Message Schema
```sql
messages (
  id uuid PRIMARY KEY,
  type text, -- 'broadcast' | 'personal'
  from_user_id uuid REFERENCES auth.users,
  to_user_id uuid REFERENCES auth.users, -- NULL for broadcast
  subject text,
  body text,
  created_at timestamp DEFAULT now(),
  read boolean DEFAULT false
)
```

---

## 5. Applications / Blogger Onboarding

### Current State
- Data: `applications` array in `src/mocks/data.ts`
- Used in: `app.super-admin.tsx`, `$lang.apply.tsx`

### Integration Points

| Location | What to Replace | Backend Feature |
|----------|----------------|-----------------|
| `$lang.apply.tsx` | Form with no submission | `INSERT INTO applications (...)` on form submit |
| `app.super-admin.tsx` → Applications | `applications` array | `SELECT * FROM applications WHERE status = 'pending'` |

### Application Schema
```sql
applications (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  lang text, -- 'EN' | 'ES'
  flickr_url text,
  instagram_url text,
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  submitted_at timestamp DEFAULT now()
)
```

---

## 6. Stats / Dashboard KPIs

### Current State
- Data: `stats` object in `src/mocks/data.ts`
- Used in: `app.super-admin.tsx`, `app.admin.tsx`

### Integration Points

| Stat | Source |
|------|--------|
| `activeBloggers` | `COUNT(*) FROM bloggers WHERE status = 'active'` |
| `inactiveBloggers` | `COUNT(*) FROM bloggers WHERE status = 'inactive'` |
| `postsThisMonth` | `COUNT(*) FROM posts WHERE created_at >= date_trunc('month', now())` |
| `productsLive` | `COUNT(*) FROM products WHERE status = 'live'` |
| `archiveSoon` | `COUNT(*) FROM products WHERE expires_at < now() + interval '7 days'` |
| `subscribers` | `COUNT(*) FROM newsletter_subscribers` |

---

## 7. File Storage

### Storage Buckets Needed

| Bucket | Purpose |
|--------|---------|
| `avatars` | Blogger profile photos |
| `products` | Product images |
| `editorial` | Landing page / about page photos |

### Upload Points
- `app.blogger.tsx` → Avatar upload (replace `blogger-avatar.jpg`)
- Admin product creation → Product image upload

---

## 8. Newsletter

### Current State
- `$lang.newsletter.tsx` has a styled form but no backend

### Integration Point
```sql
newsletter_subscribers (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  lang text DEFAULT 'EN',
  subscribed_at timestamp DEFAULT now()
)
```
- Form submit → `INSERT INTO newsletter_subscribers (email, lang)`

---

## Implementation Priority

1. **Auth + Roles** — Required before any protected route works
2. **Bloggers table + Profile** — Core user data
3. **Products table** — Core catalog data
4. **Messages table** — Communication feature
5. **Applications table** — Onboarding flow
6. **Stats aggregation** — Dashboard KPIs (can be computed from above tables)
7. **Newsletter + File Storage** — Nice-to-have enhancements

## Server Function Pattern

Use `createServerFn` from `@tanstack/react-start`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBloggers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("bloggers").select("*");
    return { bloggers: data };
  });
```

Call from components with `useServerFn` + `useQuery` (NOT from route loaders on public routes — will 401 during prerender).
