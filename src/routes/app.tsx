import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Settings,
  ScrollText,
  UsersRound,
  SlidersHorizontal,
  UserCircle2,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  FileText,
  Mail,
  Send,
  Link2,
  Download,
  LogOut,
  Circle,
  Bell,
  CircleHelp,
} from "lucide-react";
import { LangSwitch } from "@/components/brand/LangSwitch";
import { AppTextTranslator } from "@/components/app/AppTextTranslator";
import { getCurrentProfile, signOut, updateCurrentProfile, type AuthProfile } from "@/integrations/supabase/auth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import bloggerAvatar from "@/assets/blogger-avatar.jpg";
import logoIcon from "@/assets/logo-icon.png";
import { countMyUnreadNotifications } from "@/integrations/supabase/notifications";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  access?: "all" | "staff" | "super";
  section?: string;
  tour?: "blogger";
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/app/atelier", label: "Atelier", icon: Settings, access: "all" },
  { to: "/app/bloggers", label: "Bloggers", icon: UsersRound, access: "staff" },
  { to: "/app/applications", label: "Applications", icon: ClipboardCheck, access: "staff" },
  { to: "/app/admin", label: "Compose", icon: Mail, access: "staff", section: "inbox" },
  { to: "/app/admin", label: "Notifications", icon: Bell, access: "staff", section: "notifications" },
  { to: "/app/admin", label: "Newsletter", icon: Send, access: "staff", section: "newsletter" },
  { to: "/app/files-links", label: "Files & Links", icon: Link2, access: "staff" },
  { to: "/app/content-studio", label: "Content Studio", icon: SlidersHorizontal, access: "super" },
  { to: "/app/managers", label: "Managers", icon: UsersRound, access: "super" },
  { to: "/app/audit-log", label: "Audit Log", icon: ScrollText, access: "staff" },
  { to: "/app/profile", label: "Profile", icon: UserCircle2, access: "all" },
];

const BLOGGER_NAV_ITEMS: NavItem[] = [
  { to: "/app/blogger", label: "Overview", icon: LayoutDashboard, access: "all" },
  { to: "/app/blogger", label: "Products", icon: Package, access: "all", section: "products" },
  { to: "/app/blogger", label: "Posts", icon: FileText, access: "all", section: "posts" },
  { to: "/app/blogger", label: "Bag of goodies", icon: Download, access: "all", section: "goodies" },
  { to: "/app/blogger", label: "Notifications", icon: Bell, access: "all", section: "notifications" },
  { to: "/app/blogger", label: "Mailbox", icon: Mail, access: "all", section: "inbox" },
  { to: "/app/blogger", label: "Profile", icon: UserCircle2, access: "all", section: "profile" },
  { to: "/app/blogger", label: "Help!", icon: CircleHelp, access: "all", tour: "blogger" },
];

function AppLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [authError, setAuthError] = useState("");
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [storedLang, setStoredLang] = useState<"en" | "es" | null>(null);
  const isSigningOutRef = useRef(false);
  const searchLang = (loc.search as { uiLang?: string } | undefined)?.uiLang;
  const routeLang = (searchLang === "es" ? "es" : "en") as "en" | "es";
  const appLanguage = (searchLang === "es" || searchLang === "en"
    ? searchLang
    : storedLang === "es" || storedLang === "en"
      ? storedLang
    : profile?.language_preference === "es"
      ? "es"
      : "en") as "en" | "es";
  const currentSection = (loc.search as { section?: string } | undefined)?.section;
  const currentTour = (loc.search as { tour?: string } | undefined)?.tour;

  const isActive = (to: string) => loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  const isItemActive = (item: NavItem) => {
    if (item.to === "/app/blogger") {
      if (!(loc.pathname === "/app/blogger" || loc.pathname.startsWith("/app/blogger/"))) return false;
      if (item.tour) return currentTour === item.tour;
      return (item.section ?? undefined) === (currentSection ?? undefined);
    }
    if (item.section) {
      return isActive(item.to) && item.section === currentSection;
    }
    return isActive(item.to);
  };
  useEffect(() => {
    const saved = window.localStorage.getItem("love-potion-ui-lang");
    if (saved === "en" || saved === "es") setStoredLang(saved);
  }, []);

  useEffect(() => {
    if (searchLang === "en" || searchLang === "es") {
      window.localStorage.setItem("love-potion-ui-lang", searchLang);
      setStoredLang(searchLang);
    }
  }, [searchLang]);

  useEffect(() => {
    if (searchLang || (appLanguage !== "en" && appLanguage !== "es")) return;
    if (appLanguage === "en" && !storedLang && profile?.language_preference !== "es") return;

    void navigate({
      to: loc.pathname,
      search: (prev) => ({ ...(prev as object), uiLang: appLanguage }),
      replace: true,
    } as never);
  }, [appLanguage, loc.pathname, navigate, profile?.language_preference, searchLang, storedLang]);

  const visibleItems = useMemo(
    () => {
      const addBadges = (items: NavItem[]) =>
        items.map((item) => {
          if (item.to === "/app/applications") {
            return { ...item, badge: pendingApplicationsCount };
          }
          if (item.section === "notifications") {
            return { ...item, badge: notificationUnreadCount };
          }
          return item;
        });
      if (!profile) return addBadges(NAV_ITEMS.filter((item) => item.access === "all"));
      if (profile.role === "blogger") return addBadges(BLOGGER_NAV_ITEMS);
      if (profile.role === "super_admin") return addBadges(NAV_ITEMS);
      return addBadges(NAV_ITEMS.filter((item) => item.access !== "super"));
    },
    [notificationUnreadCount, pendingApplicationsCount, profile],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!isSupabaseConfigured) {
        setAuthError("Supabase environment is missing.");
        setIsLoadingProfile(false);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        await navigate({ to: "/$lang/login", params: { lang: routeLang } });
        return;
      }

      try {
        const currentProfile = await getCurrentProfile(data.session.user.id);
        if (!isMounted) return;

        if (!currentProfile) {
          setAuthError("Authenticated user has no profile row.");
        } else {
          setProfile(currentProfile);
          const savedLang = window.localStorage.getItem("love-potion-ui-lang");
          const profileLang = currentProfile.language_preference === "es" ? "es" : "en";
          if (!searchLang && savedLang !== profileLang) {
            window.localStorage.setItem("love-potion-ui-lang", profileLang);
          }
          if (!searchLang && (savedLang === "es" || savedLang === "en") && savedLang === profileLang) {
            await navigate({
              to: loc.pathname,
              search: (prev) => ({ ...(prev as object), uiLang: savedLang }),
              replace: true,
            } as never);
          } else if (!searchLang && profileLang) {
            await navigate({
              to: loc.pathname,
              search: (prev) => ({ ...(prev as object), uiLang: profileLang }),
              replace: true,
            } as never);
          }
        }
      } catch (error) {
        if (!isMounted) return;
        setAuthError(error instanceof Error ? error.message : "Could not load profile.");
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }
    }

    void loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isSigningOutRef.current) return;
      if (!session) {
        void navigate({ to: "/$lang/login", params: { lang: routeLang } });
      }
    });

    const onProfileUpdated = (event: Event) => {
      const custom = event as CustomEvent<AuthProfile>;
      if (custom.detail) setProfile(custom.detail);
    };
    window.addEventListener("profile-updated", onProfileUpdated as EventListener);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener("profile-updated", onProfileUpdated as EventListener);
    };
  }, [loc.pathname, navigate, routeLang, searchLang]);

  useEffect(() => {
    if (!profile || profile.role === "blogger") {
      setPendingApplicationsCount(0);
      return;
    }

    let mounted = true;
    let intervalId: number | undefined;

    async function loadPendingApplicationsCount() {
      try {
        const { count, error } = await supabase
          .from("blogger_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");

        if (error) throw error;
        if (mounted) setPendingApplicationsCount(count ?? 0);
      } catch (error) {
        console.error("[Sidebar] failed to load application count", error);
        if (mounted) setPendingApplicationsCount(0);
      }
    }

    void loadPendingApplicationsCount();
    intervalId = window.setInterval(() => void loadPendingApplicationsCount(), 60_000);
    window.addEventListener("focus", loadPendingApplicationsCount);

    return () => {
      mounted = false;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("focus", loadPendingApplicationsCount);
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      setNotificationUnreadCount(0);
      return;
    }

    let mounted = true;
    let intervalId: number | undefined;

    async function loadNotificationCount() {
      try {
        const count = await countMyUnreadNotifications(profile.id);
        if (mounted) setNotificationUnreadCount(count);
      } catch (error) {
        console.error("[Sidebar] failed to load notification count", error);
        if (mounted) setNotificationUnreadCount(0);
      }
    }

    const onNotificationsUpdated = () => void loadNotificationCount();

    void loadNotificationCount();
    intervalId = window.setInterval(() => void loadNotificationCount(), 60_000);
    window.addEventListener("focus", loadNotificationCount);
    window.addEventListener("notifications-updated", onNotificationsUpdated);

    return () => {
      mounted = false;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("focus", loadNotificationCount);
      window.removeEventListener("notifications-updated", onNotificationsUpdated);
    };
  }, [profile]);

  async function handleSignOut() {
    const lang = profile?.language_preference ?? routeLang ?? "en";
    isSigningOutRef.current = true;
    try {
      await signOut();
    } finally {
      window.location.replace(`/${lang}/login`);
    }
  }

  async function handleQuickStatus(status: "available" | "vacation" | "busy" | "offline") {
    if (!profile) return;
    try {
      const updated = await updateCurrentProfile({ availability_status: status });
      setProfile(updated);
    } catch (error) {
      console.error("[Sidebar] quick status update failed", error);
    }
  }

  if (isLoadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="font-display text-4xl">love potion<span className="text-[var(--brand-magenta)]">.</span></div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.35em] text-foreground/50">
            checking your access
          </p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--brand-magenta)]">
            access paused
          </div>
          <h1 className="mt-3 font-display text-4xl">We found the door, not the key.</h1>
          <p className="mt-3 text-sm text-foreground/65">{authError}</p>
          <button
            onClick={handleSignOut}
            className="mt-6 rounded-full bg-foreground px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background"
          >
            back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-app-i18n-root>
      <AppTextTranslator language={appLanguage} />
      <div className="flex">
        <aside className="relative sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-foreground/10 p-6 md:flex md:flex-col">
          <Link to="/$lang" params={{ lang: profile?.language_preference ?? routeLang }} className="block">
            <div className="flex items-end gap-2">
              <img src={logoIcon} alt="Love Potion icon" className="h-7 w-7 object-contain" />
              <div className="font-display text-2xl leading-none">
                love potion<span className="text-[var(--brand-magenta)]">.</span>
              </div>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              ATELIER · MMXXVI
            </div>
          </Link>

          <nav className="mt-10 flex flex-col gap-1">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              Your identity
            </div>
            {profile && (
              <ProfileQuickCard
                profile={profile}
                onSignOut={handleSignOut}
                onStatusChange={handleQuickStatus}
              />
            )}
          </nav>

          <nav className="mt-8 flex flex-col gap-1">
            <div className="mb-2 font-hand text-xl leading-none text-[var(--brand-magenta)]">
              Love Potion HQ
            </div>
            {visibleItems.map((it) => {
              const active = isItemActive(it);
              const Icon = it.icon;
              const linkSearch = it.tour
                ? {
                    uiLang: appLanguage,
                    section:
                      currentSection && currentSection !== "help" ? currentSection : undefined,
                    tour: it.tour,
                  }
                : it.section
                  ? { uiLang: appLanguage, section: it.section }
                  : { uiLang: appLanguage };
              return (
                <Link
                  key={`${it.to}-${it.section ?? it.tour ?? "home"}`}
                  to={it.to}
                  search={linkSearch}
                  data-blogger-tour={it.to === "/app/blogger" ? (it.section ?? it.tour ?? "home") : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
                      : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.badge ? (
                    <span
                      className={cn(
                        "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[9px] font-bold leading-none",
                        active
                          ? "bg-[var(--brand-magenta)] text-white"
                          : "bg-[var(--brand-magenta)] text-white",
                      )}
                    >
                      {it.badge > 99 ? "99+" : it.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center justify-between border-t border-foreground/10 pt-6">
            <LangSwitch />
            <button
              onClick={handleSignOut}
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60 hover:text-foreground"
            >
              ← exit
            </button>
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/35">
            love
          </p>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ProfileQuickCard({
  profile,
  onSignOut,
  onStatusChange,
}: {
  profile: AuthProfile;
  onSignOut: () => Promise<void>;
  onStatusChange: (status: "available" | "vacation" | "busy" | "offline") => Promise<void>;
}) {
  const displayName = profile.display_name || profile.full_name || profile.email;
  const note = (profile.status_message ?? "").trim().slice(0, 60);
  const avatar = getSafeAvatarUrl(profile.avatar_url);
  const statusLabel = {
    available: "Available",
    vacation: "Vacation",
    busy: "Busy",
    offline: "Offline",
  }[profile.availability_status ?? "available"];
  const statusColor = {
    available: "bg-green-500",
    vacation: "bg-amber-400",
    busy: "bg-[var(--brand-magenta)]",
    offline: "bg-slate-400",
  }[profile.availability_status ?? "available"];
  const identityTag = profile.role === "super_admin" ? "Love Potion Owner" : profile.role.replace("_", " ");

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/80 p-3">
      <div className="flex items-start gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative mt-1 rounded-full outline-none ring-offset-2 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--brand-magenta)]">
              <img
                src={avatar}
                alt={displayName}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white/90 shadow-sm"
              />
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background", statusColor)} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="font-medium">{displayName}</DropdownMenuLabel>
            <DropdownMenuLabel className="pt-0 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/50">
              {statusLabel}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void onStatusChange("available")}>
              <Circle className="mr-2 h-3.5 w-3.5 fill-green-500 text-green-500" /> Available
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onStatusChange("vacation")}>
              <Circle className="mr-2 h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Vacation
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onStatusChange("busy")}>
              <Circle className="mr-2 h-3.5 w-3.5 fill-[var(--brand-magenta)] text-[var(--brand-magenta)]" /> Busy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onStatusChange("offline")}>
              <Circle className="mr-2 h-3.5 w-3.5 fill-slate-400 text-slate-400" /> Offline
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void onSignOut();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {note ? (
          <div className="relative min-h-[56px] min-w-0 flex-1 rounded-2xl bg-white px-3 py-2 text-left shadow-md">
            <p className="line-clamp-2 font-hand text-base leading-tight text-[var(--brand-magenta)]">{note}</p>
            <span className="absolute -left-1.5 top-7 h-3 w-3 rotate-45 bg-white" />
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <div className="truncate font-display text-lg leading-tight">{displayName}</div>
        <div className="mt-1 inline-flex max-w-full rounded-full border border-[var(--brand-magenta)]/15 bg-[var(--brand-pink)]/35 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/45">
          <span className="truncate">{identityTag}</span>
        </div>
      </div>
    </div>
  );
}

function getSafeAvatarUrl(value?: string | null) {
  if (!value || value.startsWith("blob:")) return bloggerAvatar;
  return value;
}
