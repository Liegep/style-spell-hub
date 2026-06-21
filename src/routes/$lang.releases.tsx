import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/dict";
import { releases } from "@/mocks/data";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { getProductSummaries, type ProductSummary } from "@/integrations/supabase/dashboard";

export const Route = createFileRoute("/$lang/releases")({
  component: ReleasesPage,
});

function ReleasesPage() {
  const { t } = useT();
  const [liveReleases, setLiveReleases] = useState<ProductSummary[]>([]);
  const [state, setState] = useState<"loading" | "live" | "fallback">("loading");

  useEffect(() => {
    let mounted = true;

    async function loadReleases() {
      try {
        const rows = await getProductSummaries();
        if (!mounted) return;
        setLiveReleases(rows);
        setState("live");
      } catch (error) {
        console.error("[Releases] Failed to load live releases", error);
        if (mounted) setState("fallback");
      }
    }

    void loadReleases();

    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => {
    const published = liveReleases
      .filter((release) => release.status === "available")
      .sort((a, b) => {
        const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return (b.release_date ?? "").localeCompare(a.release_date ?? "");
      })
      .map((release) => ({
        id: release.id,
        name: release.name,
        category: release.category ?? "General",
        img: release.editorial_image_url ?? release.image_url ?? "",
        date: release.release_date ?? "MMXXVI",
        note: release.handwritten_note ?? "new drop",
      }));

    if (published.length > 0) return published;
    if (state === "loading") return [];
    return releases;
  }, [liveReleases, state]);

  return (
    <main className="px-6 pt-16 md:px-12">
      <div className="mx-auto max-w-[1400px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          {t.releases.kicker}
        </div>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] md:text-[8rem]">
          {t.releases.title}
        </h1>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
          {state === "loading" ? "Syncing new releases..." : `${rows.length} new release${rows.length === 1 ? "" : "s"}`}
        </div>

        <div className="mt-16 grid gap-12 md:grid-cols-12">
          {state === "loading"
            ? [0, 1, 2].map((item) => {
                const span = item % 3 === 0 ? "md:col-span-7" : item % 3 === 1 ? "md:col-span-5" : "md:col-span-6";
                const offset = item % 2 === 0 ? "" : "md:mt-24";
                return (
                  <article key={item} className={`${span} ${offset}`}>
                    <div className="aspect-[4/5] w-full rounded-2xl bg-[var(--brand-pink)]/50" />
                    <div className="mt-4 h-10 w-2/3 rounded-full bg-[var(--brand-pink)]/50" />
                    <div className="mt-3 h-4 w-1/2 rounded-full bg-[var(--brand-pink)]/40" />
                  </article>
                );
              })
            : rows.map((r, i) => {
            const span = i % 3 === 0 ? "md:col-span-7" : i % 3 === 1 ? "md:col-span-5" : "md:col-span-6";
            const offset = i % 2 === 0 ? "" : "md:mt-24";
            return (
              <article key={r.id} className={`${span} ${offset} group`}>
                <div className="relative overflow-hidden rounded-2xl">
                  {r.img ? (
                    <img
                      src={r.img}
                      alt={r.name}
                      loading="lazy"
                      className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-[var(--brand-pink)]/50" />
                  )}
                  <div className="absolute right-3 top-3 rounded-full bg-foreground/80 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.3em] text-background">
                    Nº {String(i + 1).padStart(2, "0")} / {String(rows.length).padStart(2, "0")}
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
