import { Link } from "@tanstack/react-router";
import { ChevronDown, Circle, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/dict";
import { LangSwitch } from "./LangSwitch";
import { cn } from "@/lib/utils";
import logoIcon from "@/assets/logo-icon.png";
import bloggerAvatar from "@/assets/blogger-avatar.jpg";
import { useSiteAssetUrl } from "@/hooks/use-site-asset";
import {
  getCurrentProfile,
  getRoleHome,
  signOut,
  updateCurrentProfile,
  type AuthProfile,
} from "@/integrations/supabase/auth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PublicHeader() {
  const { t, lang } = useT();
  const logoAssetUrl = useSiteAssetUrl("logo_icon", logoIcon);
  const items = [
    { to: "/$lang" as const, label: t.nav.home, exact: true },
    { to: "/$lang/about" as const, label: t.nav.about },
    { to: "/$lang/releases" as const, label: t.nav.releases },
    { to: "/$lang/shop-info" as const, label: t.nav.shop },
    { to: "/$lang/links" as const, label: t.nav.links },
    { to: "/$lang/apply" as const, label: t.nav.apply },
  ];
  return (
    <header className="sticky top-0 z-50">
      <div className="glass mx-3 mt-3 flex items-center justify-between rounded-full px-5 py-3 md:mx-6">
        <Link to="/$lang" params={{ lang }} className="flex items-end gap-2">
          {logoAssetUrl ? (
            <img src={logoAssetUrl} alt="Love Potion icon" className="h-6 w-6 object-contain" />
          ) : (
            <span className="h-6 w-6" aria-hidden="true" />
          )}
          <span className="font-display text-xl leading-none">love potion</span>
          <span className="font-display text-xl leading-none text-[var(--brand-magenta)]">.</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              params={{ lang }}
              activeOptions={{ exact: it.exact }}
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70 hover:text-foreground transition",
              )}
              activeProps={{
                className:
                  "text-foreground underline underline-offset-8 decoration-[var(--brand-magenta)] decoration-2",
              }}
            >
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LangSwitch />
          <PublicSessionCard lang={lang} loginLabel={t.nav.login} />
        </div>
      </div>
    </header>
  );
}

function PublicSessionCard({ lang, loginLabel }: { lang: "en" | "es"; loginLabel: string }) {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          if (mounted) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        const nextProfile = await getCurrentProfile(data.session.user.id);
        if (mounted) setProfile(nextProfile);
      } catch (error) {
        console.warn("[Public header] Could not load active profile", error);
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadProfile();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <span className="h-8 w-20 rounded-full bg-foreground/5" aria-hidden="true" />;
  }

  if (!profile) {
    return (
      <Link
        to="/$lang/login"
        params={{ lang }}
        className="rounded-full bg-foreground px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-background transition hover:bg-[var(--brand-magenta)]"
      >
        {loginLabel}
      </Link>
    );
  }

  const displayName = profile.display_name || profile.full_name || profile.sl_avatar_name || profile.email;
  const home = getRoleHome(profile.role);
  const avatar = profile.avatar_url || bloggerAvatar;
  const statusLabel = {
    available: lang === "es" ? "Disponible" : "Available",
    vacation: lang === "es" ? "De vacaciones" : "Vacation",
    busy: lang === "es" ? "Ocupada" : "Busy",
    offline: lang === "es" ? "Offline" : "Offline",
  }[profile.availability_status ?? "available"];
  const statusColor = {
    available: "bg-green-500",
    vacation: "bg-amber-400",
    busy: "bg-[var(--brand-magenta)]",
    offline: "bg-slate-400",
  }[profile.availability_status ?? "available"];
  const note = (profile.status_message || statusLabel).slice(0, 42);

  async function setStatus(status: AuthProfile["availability_status"]) {
    try {
      const updated = await updateCurrentProfile({ availability_status: status });
      setProfile(updated);
    } catch (error) {
      console.warn("[Public header] Could not update status", error);
    }
  }

  async function handleSignOut() {
    await signOut();
    window.location.replace(`/${lang}/login`);
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to={home}
        search={{ uiLang: lang } as never}
        className="hidden items-center gap-2 rounded-full border border-foreground/10 bg-white/70 py-1 pl-1 pr-3 shadow-sm transition hover:border-[var(--brand-magenta)] hover:bg-white md:flex"
      >
        <span className="relative">
          <img src={avatar} alt={displayName} className="h-9 w-9 rounded-full object-cover ring-2 ring-white" />
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white", statusColor)} />
        </span>
        <span className="min-w-0">
          <span className="block max-w-[120px] truncate font-display text-sm leading-none">{displayName}</span>
          <span className="mt-1 block max-w-[120px] truncate font-hand text-sm leading-none text-[var(--brand-magenta)]">
            {note}
          </span>
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition hover:bg-[var(--brand-magenta)]"
            aria-label={lang === "es" ? "Abrir menú de perfil" : "Open profile menu"}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <span className="block font-medium">{displayName}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/50">
              {statusLabel}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void setStatus("available")}>
            <Circle className="mr-2 h-3.5 w-3.5 fill-green-500 text-green-500" />
            {lang === "es" ? "Disponible" : "Available"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void setStatus("vacation")}>
            <Circle className="mr-2 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {lang === "es" ? "De vacaciones" : "Vacation"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void setStatus("busy")}>
            <Circle className="mr-2 h-3.5 w-3.5 fill-[var(--brand-magenta)] text-[var(--brand-magenta)]" />
            {lang === "es" ? "Ocupada" : "Busy"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void setStatus("offline")}>
            <Circle className="mr-2 h-3.5 w-3.5 fill-slate-400 text-slate-400" />
            Offline
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to={home} search={{ uiLang: lang } as never}>
              {lang === "es" ? "Ir al panel" : "Go to dashboard"}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void handleSignOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {lang === "es" ? "Salir" : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
