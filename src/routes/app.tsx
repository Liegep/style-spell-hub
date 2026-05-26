import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { LangSwitch } from "@/components/brand/LangSwitch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const loc = useLocation();
  const items = [
    { to: "/app/blogger",     label: "Blogger",      sub: "Nº 01" },
    { to: "/app/admin",       label: "Admin",        sub: "Nº 02" },
    { to: "/app/super-admin", label: "Super Admin",  sub: "Nº 03" },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-foreground/10 p-6 md:flex md:flex-col">
          <Link to="/$lang" params={{ lang: "en" }} className="block">
            <div className="font-display text-2xl leading-none">
              love potion<span className="text-[var(--brand-magenta)]">.</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              ATELIER · MMXXVI
            </div>
          </Link>

          <nav className="mt-12 flex flex-col gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              Roles
            </div>
            {items.map((it) => {
              const active = loc.pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "group flex items-baseline justify-between rounded-xl px-3 py-3 transition",
                    active
                      ? "bg-foreground text-background"
                      : "hover:bg-foreground/5",
                  )}
                >
                  <span className="font-display text-lg">{it.label}</span>
                  <span className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.3em]",
                    active ? "text-background/70" : "text-foreground/50",
                  )}>{it.sub}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center justify-between border-t border-foreground/10 pt-6">
            <LangSwitch />
            <Link
              to="/$lang" params={{ lang: "en" }}
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60 hover:text-foreground"
            >
              ← exit
            </Link>
          </div>
          <p className="mt-4 font-hand text-xl text-[var(--brand-magenta)] leading-tight">
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
