import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import loginImg from "@/assets/login-editorial.jpg";
import { useT } from "@/i18n/dict";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { LangSwitch } from "@/components/brand/LangSwitch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$lang/login")({
  component: LoginPage,
});

type Role = "blogger" | "admin" | "super";

function LoginPage() {
  const { t, lang } = useT();
  const [role, setRole] = useState<Role>("blogger");
  const navigate = useNavigate();

  const target = role === "super" ? "/app/super-admin" : role === "admin" ? "/app/admin" : "/app/blogger";

  return (
    <main className="grid min-h-[calc(100vh-100px)] grid-cols-1 md:grid-cols-2">
      {/* editorial */}
      <div className="relative hidden overflow-hidden md:block">
        <img
          src={loginImg}
          alt="Love Potion"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--brand-magenta)]/30 via-transparent to-transparent" />
        <div className="absolute left-6 top-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/80">
            Nº I · LOVE POTION · MMXXVI
          </span>
        </div>
        <div className="absolute bottom-10 left-10">
          <h2 className="font-display text-6xl leading-[0.9] text-white drop-shadow">
            STEP <br/> INSIDE.
          </h2>
          <p className="font-hand mt-4 text-4xl text-white">{t.slogan}</p>
        </div>
      </div>

      {/* form */}
      <div className="relative flex items-center justify-center px-6 py-12 md:px-12">
        <div className="absolute right-6 top-6">
          <LangSwitch />
        </div>

        <GlassCard tone="pink" className="w-full max-w-md p-8 md:p-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {t.login.kicker}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95]">{t.login.title}</h1>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {([
              { id: "blogger", label: t.login.blogger },
              { id: "admin", label: t.login.admin },
              { id: "super", label: t.login.super },
            ] as { id: Role; label: string }[]).map((r) => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className={cn(
                  "rounded-xl border px-2 py-3 font-mono text-[10px] uppercase tracking-[0.2em] transition",
                  role === r.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/30 hover:border-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                {t.login.mail}
              </span>
              <input
                type="email"
                className="mt-2 w-full rounded-full border border-foreground/30 bg-background/80 px-5 py-3 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
                placeholder="you@email.com"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                {t.login.pass}
              </span>
              <input
                type="password"
                className="mt-2 w-full rounded-full border border-foreground/30 bg-background/80 px-5 py-3 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
                placeholder="••••••••"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-foreground/70">
              <input type="checkbox" className="accent-[var(--brand-magenta)]" />
              {t.login.remember}
            </label>
            <a href="#" className="text-[var(--brand-magenta)] hover:underline">
              {t.login.forgot}
            </a>
          </div>

          <button
            onClick={() => navigate({ to: target })}
            className="mt-6 w-full rounded-full bg-foreground px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]"
          >
            {t.login.cta} →
          </button>

          <div className="mt-6 flex items-center justify-between">
            <Link
              to="/$lang/apply"
              params={{ lang }}
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70 hover:text-foreground"
            >
              ← {t.nav.apply}
            </Link>
            <HandwrittenNote>welcome</HandwrittenNote>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
