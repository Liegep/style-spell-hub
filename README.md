# Love Potion — Brand Platform

> A premium lingerie brand platform with a glassmorphism design system, built with React + TanStack Start + Tailwind CSS.

## Tech Stack

- **Framework:** React 19 + TanStack Start v1 (SSR/SSG)
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS v4 + Custom CSS Variables
- **Router:** TanStack Router (file-based)
- **Server Functions:** TanStack Start `createServerFn`
- **Icons:** Lucide React

## Architecture

### Routing Structure

```
/                      → Splash redirect (chooses EN by default)
/:lang                 → Public layout (header + footer + outlet)
  /:lang/              → Landing page (hero + brand story)
  /:lang/about         → About page
  /:lang/releases      → Product releases grid
  /:lang/newsletter    → Newsletter signup
  /:lang/apply         → Blogger application form
  /:lang/login         → Login page
  /:lang/shop-info     → Shop info page
/app                   → App shell (admin/blogger dashboard layout)
  /app/                → App home (dashboard overview)
  /app/admin           → Admin dashboard (products, bloggers, messages)
  /app/super-admin     → Super admin dashboard (stats, applications)
  /app/blogger         → Blogger dashboard (profile, posts, products)
```

### Route Types

- **Public routes** (`$lang.*.tsx`): Landing, marketing, informational pages
- **App routes** (`app.*.tsx`): Authenticated dashboards
- **Layout routes** (`$lang.tsx`, `app.tsx`): Wrap children with shared UI (header/footer or sidebar)

## Design System

### Colors (CSS Variables in `src/styles.css`)

```css
--brand-rose      : #f8d7e8   /* Primary brand pink */
--brand-coral     : #f47b8a   /* Accent coral/pink */
--brand-magenta   : #d81b7a   /* Deep magenta */
--brand-pink-glow : #fbb1d3   /* Glow/highlight pink */
--brand-gold      : #c9a84c   /* Luxury gold accent */
--brand-deep      : #7a1e5a   /* Deep plum */
```

### Typography

- **Headings:** `"Times New Roman"` with tracking `[-0.02em]`
- **Body:** `"Inter"` with tracking `[-0.01em]`
- **Editorial accents:** `"Bodoni Moda"` for elegant quotes
- **Handwritten:** `"Gloria Hallelujah"` for personal notes

### Glassmorphism System

```css
.glass      → frosted white (backdrop-blur + rgba white bg)
.glass-pink → frosted pink (backdrop-blur + rgba pink bg)
.glass-dark → frosted dark (backdrop-blur + rgba dark bg)
```

### Spacing & Shape

- Border radius: `rounded-2xl` (1rem) for cards
- Section padding: `py-24` to `py-40`
- Content max-width: `max-w-7xl`
- Layout uses CSS Grid for product grids, editorial layouts

## Component Library (`src/components/brand/`)

| Component | Purpose |
|-----------|---------|
| `GlassCard` | Frosted glass cards with 3 tone variants (light/pink/dark) |
| `PublicHeader` | Fixed navigation with language switch |
| `PublicFooter` | Footer with editorial mark and nav links |
| `LangSwitch` | Language toggle (EN/ES) with active state |
| `Tabs` | Custom tab navigation for dashboard sections |
| `EditionMark` | "MMXXVI" brand year mark |
| `HandwrittenNote` | Cursive text notes with `Gloria Hallelujah` font |
| `VerticalLabel` | Rotated 90° text labels for editorial flair |

## State & Data

### Mock Data (`src/mocks/data.ts`)

- `releases` — Product catalog items
- `bloggers` — Blogger roster with status, posts, language
- `products` — Products with claims, expiry dates
- `messages` — Broadcast and personal messages
- `applications` — Pending blogger applications
- `stats` — Dashboard KPIs

### i18n (`src/i18n/dict.ts`)

- Bilingual dictionary: English + Spanish
- Used across all public routes and some dashboard labels

## Assets

- `src/assets/hero-marie.png` — Hero image (background removed, enhanced)
- `src/assets/about-editorial.jpg` — About page editorial photo
- `src/assets/login-editorial.jpg` — Login page photo
- `src/assets/release-*.jpg` — Product photos
- `src/assets/blogger-avatar.jpg` — Blogger profile photo

## Key Constraints

1. **Do NOT change visual design** — Glassmorphism, fonts, colors, and layout are intentional brand choices.
2. **Do NOT remove or modify existing components** — Extend them, don't replace.
3. **Keep all public routes intact** — Marketing pages are the brand identity.
4. **Preserve the bilingual support** — Every new feature needs EN/ES translations.

## Backend Integration Points

See `INTEGRATION.md` for exact locations where mock data should be replaced with real API/database calls.
