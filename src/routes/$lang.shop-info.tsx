import { createFileRoute } from "@tanstack/react-router";
import { useT } from "@/i18n/dict";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";

export const Route = createFileRoute("/$lang/shop-info")({
  component: ShopPage,
});

function ShopPage() {
  const { t } = useT();
  const rows = [
    { k: t.shop.mainstore, v: t.shop.mainstoreVal },
    { k: t.shop.mp, v: t.shop.mpVal },
    { k: t.shop.group, v: t.shop.groupVal },
  ];
  return (
    <main className="px-6 pt-16 md:px-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          INFO · Nº 02
        </div>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] md:text-[7rem]">
          {t.shop.title}
        </h1>

        <p className="mt-8 max-w-xl text-lg text-foreground/80">{t.shop.copy}</p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {rows.map((r, i) => (
            <GlassCard key={r.k} tone={i === 1 ? "pink" : "light"}>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                Nº 0{i + 1}
              </div>
              <h3 className="mt-3 font-display text-2xl">{r.k}</h3>
              <p className="mt-3 text-sm text-foreground/80">{r.v}</p>
            </GlassCard>
          ))}
        </div>

        <div className="mt-16 flex justify-end">
          <HandwrittenNote withArrow>try the demo first</HandwrittenNote>
        </div>
      </div>
    </main>
  );
}
