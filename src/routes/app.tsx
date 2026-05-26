import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import {
  Settings, ScrollText, UsersRound,
  ClipboardList, Heart, MapPinned, Package, SlidersHorizontal, Bell,
  Users, Mail, MessageSquare, Inbox, UserCircle2,
} from "lucide-react";
import { LangSwitch } from "@/components/brand/LangSwitch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

type NavItem = { to: string; section?: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { title: string; items: NavItem[] };

const SUPER_ADMIN_GROUPS: NavGroup[] = [
  {
    title: "",
    items: [
      { to: "/app/super-admin", section: "settings", label: "General",   icon: Settings },
      { to: "/app/super-admin", section: "logs",     label: "Audit Log", icon: ScrollText },
      { to: "/app/super-admin", section: "admins",   label: "Managers",  icon: UsersRound },
    ],
  },
];

const ADMIN_GROUPS: NavGroup[] = [
  {
    title: "EasyBloggers",
    items: [
      { to: "/app/admin", section: "apps",          label: "Bloggers Application", icon: ClipboardList },
      { to: "/app/admin", section: "bloggers",      label: "Friends",              icon: Heart },
      { to: "/app/admin", section: "locations",     label: "Locations",            icon: MapPinned },
      { to: "/app/admin", section: "products",      label: "Products",             icon: Package },
      { to: "/app/admin", section: "preferences",   label: "Preferences",          icon: SlidersHorizontal },
      { to: "/app/admin", section: "notifications", label: "Notifications",        icon: Bell },
    ],
  },
  {
    title: "EasySubscribers",
    items: [
      { to: "/app/admin", section: "subscribers", label: "Subscribers", icon: Users },
      { to: "/app/admin", section: "newsletter", label: "Newsletters", icon: Mail },
    ],
  },
];

const BLOGGER_GROUPS: NavGroup[] = [
  {
    title: "Studio",
    items: [
      { to: "/app/blogger", section: "products", label: "Products", icon: Package },
      { to: "/app/blogger", section: "posts",    label: "Posts",    icon: MessageSquare },
      { to: "/app/blogger", section: "inbox",    label: "Mailbox",  icon: Inbox },
      { to: "/app/blogger", section: "profile",  label: "Profile",  icon: UserCircle2 },
    ],
  },
];



function AppLayout() {
  const loc = useLocation();
  const search = loc.search as { section?: string };
  const currentSection = search?.section ?? "";

  const roles = [
    { to: "/app/blogger",     label: "Blogger",      sub: "Nº 01" },
    { to: "/app/admin",       label: "Admin",        sub: "Nº 02" },
    { to: "/app/super-admin", label: "Super Admin",  sub: "Nº 03" },
  ];

  const isSuper   = loc.pathname.startsWith("/app/super-admin");
  const isAdmin   = loc.pathname.startsWith("/app/admin");
  const isBlogger = loc.pathname.startsWith("/app/blogger");
  const groups: NavGroup[] =
    isSuper ? SUPER_ADMIN_GROUPS :
    isAdmin ? ADMIN_GROUPS :
    isBlogger ? BLOGGER_GROUPS : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-foreground/10 p-6 md:flex md:flex-col">
          <Link to="/$lang" params={{ lang: "en" }} className="block">
            <div className="font-display text-2xl leading-none">
              love potion<span className="text-[var(--brand-magenta)]">.</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              ATELIER · MMXXVI
            </div>
          </Link>

          <nav className="mt-10 flex flex-col gap-1">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              Roles
            </div>
            {roles.map((it) => {
              const active = loc.pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "group flex items-baseline justify-between rounded-xl px-3 py-2.5 transition",
                    active
                      ? "bg-foreground text-background"
                      : "hover:bg-foreground/5",
                  )}
                >
                  <span className="font-display text-base">{it.label}</span>
                  <span className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.3em]",
                    active ? "text-background/70" : "text-foreground/50",
                  )}>{it.sub}</span>
                </Link>
              );
            })}
          </nav>

          {groups.map((g) => (
            <nav key={g.title || "main"} className="mt-8 flex flex-col gap-1">
              {g.title && (
                <div className="mb-2 font-hand text-xl text-[var(--brand-magenta)] leading-none">
                  {g.title}
                </div>
              )}
              {g.items.map((it) => {
                const active = loc.pathname.startsWith(it.to) && currentSection === it.section;
                const Icon = it.icon;
                return (
                  <Link
                    key={it.label}
                    to={it.to}
                    search={{ section: it.section }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      active
                        ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
                        : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </nav>
          ))}

          <div className="mt-auto flex items-center justify-between border-t border-foreground/10 pt-6">
            <LangSwitch />
            <Link
              to="/$lang" params={{ lang: "en" }}
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60 hover:text-foreground"
            >
              ← exit
            </Link>
          </div>
          <p className="mt-4 font-hand text-lg text-[var(--brand-magenta)] leading-tight">
            preview only —<br/>wire it up later.
          </p>
        </aside>

        {/* MAIN */}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
