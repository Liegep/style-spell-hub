import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-avatar.jpg";
import { useT } from "@/i18n/dict";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { EditionMark } from "@/components/brand/EditionMark";
import { releases } from "@/mocks/data";

export const Route = createFileRoute("/$lang/")({
  component: Landing,
});

function Landing() {
  const { t, lang } = useT();
  return (
    <main className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden px-3 pt-6 md:px-6">
        <div className="relative mx-auto max-w-[1600px]">
          {/* huge headline behind image */}
          <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
            <h1 className="font-display text-[22vw] leading-[0.85] text-[var(--brand-ink)] md:text-[18vw] tracking-tighter">
              {t.hero.headline_top}
            </h1>
            <h1 className="font-display text-[22vw] leading-[0.85] text-[var(--brand-ink)] md:text-[18vw] tracking-tighter -mt-[3vw]">
              {t.hero.headline_bottom}
            </h1>
          </div>

          {/* image */}
          <div className="relative z-10 mx-auto flex max-w-3xl justify-center pt-[10vw]">
            <img
              src={heroImg}
              alt="Love Potion avatar"
              width={1080}
              height={1600}
              className="w-[55vw] max-w-[640px] object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.15)]"
            />
          </div>

          {/* coral wash overlay */}
          <div
            className="pointer-events-none absolute z-20 left-1/2 top-[55%] h-[40vw] w-[36vw] -translate-x-[8%] rounded-full mix-blend-multiply"
            style={{
              background:
                "radial-gradient(closest-side, var(--brand-coral) 30%, transparent 75%)",
              opacity: 0.55,
            }}
          />

          {/* vertical labels */}
          <div className="absolute left-3 top-32 z-30 hidden md:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-foreground/70 [writing-mode:vertical-rl] rotate-180">
              {t.hero.kicker}
            </p>
          </div>

          {/* edition mark top right */}
          <div className="absolute right-4 top-4 z-30 hidden md:block">
            <EditionMark />
          </div>

          {/* "the spell" handwritten */}
          <div className="absolute right-6 top-[28%] z-30 hidden md:flex flex-col items-end">
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-[var(--brand-magenta)]">
              our slogan.<br/>cast across<br/>the grid.
            </span>
            <div className="mt-2">
              <HandwrittenNote withArrow>{t.hero.handwritten}</HandwrittenNote>
            </div>
          </div>

          {/* magenta X */}
          <div className="absolute right-[10%] top-[18%] z-30 hidden md:block">
            <span className="font-display text-[10vw] leading-none text-[var(--brand-magenta)]">x</span>
          </div>

          {/* bottom CTA */}
          <div className="relative z-30 mt-[4vw] flex flex-col items-start gap-6 px-2 md:flex-row md:items-end md:justify-between md:px-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                FIRST TIME? <br/>READ OUR HOUSE →
              </div>
              <h2 className="mt-4 max-w-md font-display text-3xl leading-[1.05] md:text-4xl">
                STYLE IS WHAT <br/>WE CAST.
              </h2>
              <p className="mt-3 max-w-sm text-sm text-foreground/70">{t.hero.sub}</p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <div className="flex gap-2">
                <Link
                  to={`/${lang}/login`}
                  className="rounded-full bg-foreground px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]"
                >
                  {t.hero.ctaBlogger}
                </Link>
                <Link
                  to={`/${lang}/apply`}
                  className="rounded-full border border-foreground/40 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] hover:bg-foreground hover:text-background"
                >
                  {t.hero.ctaApply}
                </Link>
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                <span>{t.hero.scroll}</span>
                <span className="block h-[1px] w-12 bg-foreground/50" />
                <span>↓</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL STRIP */}
      <section className="mt-24 px-6 md:px-12">
        <GlassCard tone="pink" className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              FIND THE HOUSE
            </div>
            <h3 className="mt-2 font-display text-3xl">Follow the spell.</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {[t.socials.flickr, t.socials.mp, t.socials.fb].map((s) => (
              <a
                key={s}
                href="#"
                className="rounded-full bg-foreground/90 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]"
              >
                {s} →
              </a>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* LATEST RELEASES TEASER */}
      <section className="mt-32 px-6 md:px-12">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {t.releases.kicker}
            </div>
            <h2 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">
              {t.releases.title}
            </h2>
          </div>
          <Link
            to={`/${lang}/releases`}
            className="hidden rounded-full border border-foreground/40 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:bg-foreground hover:text-background md:inline-block"
          >
            {t.releases.cta} →
          </Link>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {releases.slice(0, 3).map((r, i) => (
            <article
              key={r.id}
              className={`group relative ${i === 1 ? "md:translate-y-12" : ""}`}
            >
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={r.img}
                  alt={r.name}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute left-3 top-3 rounded-full bg-foreground/80 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.3em] text-background">
                  {t.releases.newTag}
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <h3 className="font-display text-xl">{r.name}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                    {r.category} · {r.date}
                  </p>
                </div>
                <HandwrittenNote>{r.note}</HandwrittenNote>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
