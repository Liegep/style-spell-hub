import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { useT } from "@/i18n/dict";
import { completePasswordReset, signOut } from "@/integrations/supabase/auth";

export const Route = createFileRoute("/$lang/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t, lang } = useT();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setStatus("error");
      setMessage(t.login.resetLength);
      return;
    }
    if (password !== confirmation) {
      setStatus("error");
      setMessage(t.login.resetMismatch);
      return;
    }

    setStatus("loading");
    try {
      await completePasswordReset(password);
      await signOut();
      setStatus("done");
      setMessage(t.login.resetDone);
      setPassword("");
      setConfirmation("");
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
        <h1 className="mt-2 font-display text-5xl leading-[0.95]">{t.login.resetTitle}</h1>

        {status !== "done" ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <PasswordField
              label={t.login.newPassword}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <PasswordField
              label={t.login.confirmPassword}
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
            />

            {message ? (
              <p className="rounded-2xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/50 px-4 py-3 text-xs text-[var(--brand-magenta)]">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-full bg-foreground px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-wait disabled:opacity-60"
            >
              {status === "loading" ? t.login.resetSaving : `${t.login.resetCta} →`}
            </button>
          </form>
        ) : (
          <p className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </p>
        )}

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

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-full border border-foreground/30 bg-background/80 px-5 py-3 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
        autoComplete={autoComplete}
        minLength={8}
        required
      />
    </label>
  );
}
