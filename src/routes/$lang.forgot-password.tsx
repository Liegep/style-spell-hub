import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { useT } from "@/i18n/dict";
import { requestPasswordReset } from "@/integrations/supabase/auth";

export const Route = createFileRoute("/$lang/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t, lang } = useT();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      await requestPasswordReset(email, lang);
      setStatus("sent");
      setMessage(t.login.forgotSent);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.login.failed);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-100px)] items-center justify-center px-6 py-12">
      <GlassCard tone="pink" className="w-full max-w-md p-8 md:p-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          {t.login.access}
        </div>
        <h1 className="mt-2 font-display text-5xl leading-[0.95]">{t.login.forgotTitle}</h1>
        <p className="mt-4 text-sm text-foreground/65">{t.login.forgotIntro}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
              {t.login.mail}
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-full border border-foreground/30 bg-background/80 px-5 py-3 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
              placeholder="you@email.com"
              autoComplete="email"
              required
            />
          </label>

          {message ? (
            <p
              className={`rounded-2xl border px-4 py-3 text-xs ${
                status === "sent"
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-800"
                  : "border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/50 text-[var(--brand-magenta)]"
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={status === "loading" || status === "sent"}
            className="w-full rounded-full bg-foreground px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-wait disabled:opacity-60"
          >
            {status === "loading" ? t.login.forgotSending : `${t.login.forgotCta} →`}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <Link
            to="/$lang/login"
            params={{ lang }}
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70 hover:text-foreground"
          >
            ← {t.login.backToLogin}
          </Link>
          <HandwrittenNote>{t.login.handwritten}</HandwrittenNote>
        </div>
      </GlassCard>
    </main>
  );
}
