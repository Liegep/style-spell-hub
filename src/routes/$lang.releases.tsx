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
  const { t, lang } = useT();
  const [liveReleases, setLiveReleases] = useState<ProductSummary[]>([]);
  const [state, setState] = useState<"loading" | "live" | "fallback">("loading");
  const copy = {
    syncing: lang === "es" ? "sincronizando lanzamientos..." : "syncing new releases...",
    defaultCategory: lang === "es" ? "General" : "General",
    defaultNote: lang === "es" ? "nuevo lanzamiento" : "new drop",
    empty: lang === "es" ? "Pronto habrá nuevos hechizos aquí." : "New spells will arrive here soon.",
  };

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
        category: release.category ?? copy.defaultCategory,
        img: release.editorial_image_url ?? release.image_url ?? "",
        date: release.release_date ?? "MMXXVI",
        note: release.handwritten_note ?? copy.defaultNote,
      }));

    if (published.length > 0) return published;
    if (state === "loading") return [];
    return releases;
  }, [copy.defaultCategory, copy.defaultNote, liveReleases, state]);

  const releaseCountLabel =
    state === "loading"
      ? copy.syncing
      : lang === "es"
        ? `${rows.length} lanzamiento${rows.length === 1 ? "" : "s"}`
        : `${rows.length} release${rows.length === 1 ? "" : "s"}`;

  return (
    <main className="px-6 pt-28 md:px-12 md:pt-32">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              {t.releases.kicker}
            </div>
            <h1 className="mt-3 max-w-5xl font-display text-6xl leading-[0.88] md:text-[7rem]">
              {t.releases.title}
            </h1>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <span className="rounded-full bg-[var(--brand-pink)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--brand-magenta)]">
              {releaseCountLabel}
            </span>
            <HandwrittenNote withArrow>
              {lang === "es" ? "recién llegado" : "fresh arrivals"}
            </HandwrittenNote>
          </div>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {state === "loading"
            ? [0, 1, 2].map((item) => {
                return (
                  <article key={item} className="rounded-[1.75rem] border border-[var(--brand-pink)] bg-white/45 p-4 shadow-lg shadow-[var(--brand-pink)]/30">
                    <div className="aspect-[4/5] w-full rounded-2xl bg-[var(--brand-pink)]/50" />
                    <div className="mt-4 h-10 w-2/3 rounded-full bg-[var(--brand-pink)]/50" />
                    <div className="mt-3 h-4 w-1/2 rounded-full bg-[var(--brand-pink)]/40" />
                  </article>
                );
              })
            : rows.length > 0
              ? rows.map((r, i) => (
                  <article
                    key={r.id}
                    className="group rounded-[1.75rem] border border-[var(--brand-pink)] bg-white/45 p-4 shadow-lg shadow-[var(--brand-pink)]/30 transition duration-300 hover:-translate-y-1 hover:bg-white/65"
                  >
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
                      <div className="absolute right-3 top-3 rounded-full bg-foreground/85 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.3em] text-background">
                        Nº {String(i + 1).padStart(2, "0")} / {String(rows.length).padStart(2, "0")}
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                          {r.category} · {r.date}
                        </p>
                        <h2 className="mt-1 font-display text-3xl leading-none md:text-4xl">{r.name}</h2>
                      </div>
                      <HandwrittenNote>{r.note}</HandwrittenNote>
                    </div>
                  </article>
                ))
              : (
                  <div className="rounded-[1.75rem] border border-dashed border-foreground/15 bg-white/45 p-12 text-center md:col-span-2 xl:col-span-3">
                    <HandwrittenNote>{copy.empty}</HandwrittenNote>
                  </div>
                )}
        </div>
      </div>
    </main>
  );
}
