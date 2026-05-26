import { Link } from "@tanstack/react-router";
import { useT } from "@/i18n/dict";
import { LangSwitch } from "./LangSwitch";
import { cn } from "@/lib/utils";

export function PublicHeader() {
  const { t, lang } = useT();
  const base = `/${lang}`;
  const items = [
    { to: `${base}`, label: t.nav.home },
    { to: `${base}/about`, label: t.nav.about },
    { to: `${base}/releases`, label: t.nav.releases },
    { to: `${base}/shop-info`, label: t.nav.shop },
    { to: `${base}/newsletter`, label: t.nav.newsletter },
    { to: `${base}/apply`, label: t.nav.apply },
  ];
  return (
    <header className="sticky top-0 z-50">
      <div className="glass mx-3 mt-3 flex items-center justify-between rounded-full px-5 py-3 md:mx-6">
        <Link to={base} className="flex items-end gap-1">
          <span className="font-display text-xl leading-none">love potion</span>
          <span className="font-display text-xl leading-none text-[var(--brand-magenta)]">.</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              activeOptions={{ exact: true }}
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70 hover:text-foreground transition",
              )}
              activeProps={{
                className: "text-foreground underline underline-offset-8 decoration-[var(--brand-magenta)] decoration-2",
              }}
            >
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LangSwitch />
          <Link
            to={`${base}/login`}
            className="rounded-full bg-foreground px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-background transition hover:bg-[var(--brand-magenta)]"
          >
            {t.nav.login}
          </Link>
        </div>
      </div>
    </header>
  );
}
