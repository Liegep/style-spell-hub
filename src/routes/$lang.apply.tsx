import { createFileRoute } from "@tanstack/react-router";
import { useT } from "@/i18n/dict";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";

export const Route = createFileRoute("/$lang/apply")({
  component: ApplyPage,
});

function ApplyPage() {
  const { t } = useT();
  const fields = [
    { k: t.apply.sl, ph: "Resident.Lastname" },
    { k: t.apply.mail, ph: "you@email.com" },
    { k: t.apply.flickr, ph: "flickr.com/you" },
    { k: t.apply.fb, ph: "@yourhandle" },
    { k: t.apply.languages, ph: "EN, ES, FR…" },
    { k: t.apply.hours, ph: "10–20 / week" },
  ];
  return (
    <main className="px-6 pt-16 md:px-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          {t.apply.kicker}
        </div>
        <div className="mt-3 flex items-end justify-between gap-6">
          <h1 className="font-display text-6xl leading-[0.9] md:text-[7rem]">
            {t.apply.title}
          </h1>
          <div className="hidden md:block">
            <HandwrittenNote withArrow>we read every word</HandwrittenNote>
          </div>
        </div>
        <p className="mt-6 max-w-xl text-lg text-foreground/80">{t.apply.intro}</p>

        <GlassCard tone="pink" className="mt-12 p-8 md:p-12">
          <div className="grid gap-6 md:grid-cols-2">
            {fields.map((f) => (
              <label key={f.k} className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                  {f.k}
                </span>
                <input
                  className="mt-2 w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 font-mono text-sm placeholder:text-foreground/40 focus:border-[var(--brand-magenta)] focus:outline-none"
                  placeholder={f.ph}
                />
              </label>
            ))}
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                {t.apply.cam}
              </span>
              <textarea
                rows={4}
                className="mt-2 w-full rounded-2xl border border-foreground/30 bg-background/70 px-5 py-3 font-mono text-sm placeholder:text-foreground/40 focus:border-[var(--brand-magenta)] focus:outline-none"
                placeholder="Firestorm, Black Dragon, no edit, heavy edit…"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                {t.apply.why}
              </span>
              <textarea
                rows={4}
                className="mt-2 w-full rounded-2xl border border-foreground/30 bg-background/70 px-5 py-3 font-mono text-sm placeholder:text-foreground/40 focus:border-[var(--brand-magenta)] focus:outline-none"
                placeholder="Tell us in your own voice."
              />
            </label>
          </div>

          <div className="mt-10 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {t.apply.note}
            </p>
            <button className="rounded-full bg-foreground px-8 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
              {t.apply.submit} →
            </button>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
