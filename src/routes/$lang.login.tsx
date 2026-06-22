import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import loginImg from "@/assets/login-editorial.jpg";
import { useT } from "@/i18n/dict";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { getCurrentProfile, getRoleHome, signInWithIdentifier } from "@/integrations/supabase/auth";
import { supabase } from "@/integrations/supabase/client";
import { useSiteAssetUrl } from "@/hooks/use-site-asset";
import type { AuthProfile } from "@/integrations/supabase/auth";

export const Route = createFileRoute("/$lang/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const loginAssetUrl = useSiteAssetUrl("login_editorial", loginImg);

  async function enterAppWithProfileLanguage(profile: AuthProfile) {
    const uiLang = profile.language_preference === "es" ? "es" : "en";
    window.localStorage.setItem("love-potion-ui-lang", uiLang);
    await navigate({
      to: getRoleHome(profile.role),
      search: { uiLang },
    } as never);
  }

  useEffect(() => {
    let mounted = true;

    async function bounceIfAlreadyLogged() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted || error || !data.session) return;

        const profile = await getCurrentProfile(data.session.user.id);
        if (!mounted) return;

        if (profile) {
          await enterAppWithProfileLanguage(profile);
        } else {
          await navigate({ to: "/app/atelier" });
        }
      } catch (error) {
        console.warn("[Login] Could not restore existing session.", error);
      }
    }

    void bounceIfAlreadyLogged();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const { profile } = await signInWithIdentifier(identifier, password);

      if (!profile) {
        throw new Error(t.login.missingProfile);
      }

      if (profile.account_status === "left") {
        throw new Error(t.login.leftAccount);
      }

      await enterAppWithProfileLanguage(profile);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.login.failed);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-100px)] grid-cols-1 md:grid-cols-2">
      {/* editorial */}
      <div className="relative hidden overflow-hidden md:block">
        {loginAssetUrl ? (
          <img
            src={loginAssetUrl}
            alt="Love Potion"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--brand-pink)]/50" />
        )}
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
        <GlassCard tone="pink" className="w-full max-w-md p-8 md:p-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {t.login.access}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95]">{t.login.title}</h1>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                {t.login.identifier}
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="mt-2 w-full rounded-full border border-foreground/30 bg-background/80 px-5 py-3 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
                placeholder="Marie Whitfield"
                autoComplete="username"
                required
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                {t.login.pass}
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-full border border-foreground/30 bg-background/80 px-5 py-3 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </label>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-foreground/70">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="accent-[var(--brand-magenta)]"
              />
              {t.login.remember}
              </label>
              <a href="#" className="text-[var(--brand-magenta)] hover:underline">
                {t.login.forgot}
              </a>
            </div>

            {status === "error" ? (
              <p className="rounded-2xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/50 px-4 py-3 text-xs text-[var(--brand-magenta)]">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-full bg-foreground px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-wait disabled:opacity-60"
            >
              {status === "loading" ? t.login.loading : `${t.login.cta} →`}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <Link
              to="/$lang/apply"
              params={{ lang }}
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70 hover:text-foreground"
            >
              ← {t.nav.apply}
            </Link>
            <HandwrittenNote>{t.login.handwritten}</HandwrittenNote>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
