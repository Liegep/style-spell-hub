import { createFileRoute } from "@tanstack/react-router";
import { useT } from "@/i18n/dict";
import { releases } from "@/mocks/data";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";

export const Route = createFileRoute("/$lang/releases")({
  component: ReleasesPage,
});

function ReleasesPage() {
  const { t } = useT();
  return (
    <main className="px-6 pt-16 md:px-12">
      <div className="mx-auto max-w-[1400px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          {t.releases.kicker}
        </div>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] md:text-[8rem]">
          {t.releases.title}
        </h1>

        <div className="mt-16 grid gap-12 md:grid-cols-12">
          {releases.map((r, i) => {
            const span = i % 3 === 0 ? "md:col-span-7" : i % 3 === 1 ? "md:col-span-5" : "md:col-span-6";
            const offset = i % 2 === 0 ? "" : "md:mt-24";
            return (
              <article key={r.id} className={`${span} ${offset} group`}>
                <div className="relative overflow-hidden rounded-2xl">
                  <img
                    src={r.img}
                    alt={r.name}
                    loading="lazy"
                    className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3 rounded-full bg-foreground/80 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.3em] text-background">
                    Nº {String(i + 1).padStart(2, "0")} / {String(releases.length).padStart(2, "0")}
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-3xl md:text-4xl">{r.name}</h2>
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                      {r.category} · {r.date}
                    </p>
                  </div>
                  <HandwrittenNote>{r.note}</HandwrittenNote>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
