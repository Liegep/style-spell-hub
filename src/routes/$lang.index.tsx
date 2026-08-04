import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import heroImg from "@/assets/hero-marie.png";
import tssWeekendLogo from "@/assets/event-tss-weekend-2026.png";
import cosmopolitanLogo from "@/assets/event-cosmopolitan-logo.png";
import waifuDreamsLogo from "@/assets/event-waifu-dreams-2025-logo.png";
import { useT } from "@/i18n/dict";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { EditionMark } from "@/components/brand/EditionMark";
import { ScrollReveal } from "@/components/brand/ScrollReveal";
import { releases } from "@/mocks/data";
import { getProductSummaries, type ProductSummary } from "@/integrations/supabase/dashboard";
import { useSiteAssetUrl } from "@/hooks/use-site-asset";
import { useSiteContent } from "@/hooks/use-site-content";
import { publicSocialLinks } from "@/lib/public-links";

export const Route = createFileRoute("/$lang/")({
  component: Landing,
});

function Landing() {
  const { t, lang } = useT();
  const landingText =
    lang === "es"
      ? {
          sloganLabel: (
            <>
              nuestro lema.<br/>lanzado por<br/>todo el grid.
            </>
          ),
          firstTime: (
            <>
              ¿Primera vez? <br/>lee nuestra casa →
            </>
          ),
          styleCast: (
            <>
              EL ESTILO ES <br/>NUESTRO HECHIZO.
            </>
          ),
          newsKicker: "Nuevo en el grid",
          emptyNewsTitle: "Un nuevo hechizo se está mezclando.",
          emptyNewsBody: "Vuelve pronto para ver el próximo lanzamiento de Love Potion.",
          newsCta: "Ver nuevos lanzamientos",
          soon: "pronto",
          socialKicker: "ENCUENTRA LA CASA",
          socialTitle: "Sigue el hechizo.",
          syncing: "sincronizando lanzamientos...",
          defaultCategory: "Nuevo lanzamiento",
          defaultDescription: "Un nuevo lanzamiento de Love Potion llegó al grid.",
          defaultNote: "nuevo drop",
          eventsKicker: "DONDE APARECEMOS",
          eventsTitle: "Círculo de eventos.",
          eventsBody: "Las casas y sales donde Love Potion sigue apareciendo.",
        }
        : {
          sloganLabel: (
            <>
              our slogan.<br/>cast across<br/>the grid.
            </>
          ),
          firstTime: (
            <>
              FIRST TIME? <br/>READ OUR HOUSE →
            </>
          ),
          styleCast: (
            <>
              STYLE IS WHAT <br/>WE CAST.
            </>
          ),
          newsKicker: "New on the grid",
          emptyNewsTitle: "A new spell is being mixed.",
          emptyNewsBody: "Check back soon for the next Love Potion release.",
          newsCta: "See new releases",
          soon: "soon",
          socialKicker: "FIND THE HOUSE",
          socialTitle: "Follow the spell.",
          syncing: "syncing releases...",
          defaultCategory: "New release",
          defaultDescription: "A fresh Love Potion release has arrived on the grid.",
          defaultNote: "new drop",
          eventsKicker: "WHERE WE APPEAR",
          eventsTitle: "Event circle.",
          eventsBody: "The houses and sales where Love Potion keeps showing up.",
        };
  const [liveReleases, setLiveReleases] = useState<ProductSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const heroAssetUrl = useSiteAssetUrl("landing_hero", heroImg);
  const content = useSiteContent(lang, {
    hero_headline_top: t.hero.headline_top,
    hero_headline_bottom: t.hero.headline_bottom,
    hero_kicker: t.hero.kicker,
    hero_handwritten: t.hero.handwritten,
    hero_sub: t.hero.sub,
    hero_cta_blogger: t.hero.ctaBlogger,
    hero_cta_apply: t.hero.ctaApply,
  });

  useEffect(() => {
    let mounted = true;

    async function loadLiveReleases() {
      try {
        const rows = await getProductSummaries();
        if (!mounted) return;
        setLiveReleases(rows);
      } catch (error) {
        console.error("[Landing] Failed to load releases", error);
      } finally {
        if (mounted) setLoaded(true);
      }
    }

    void loadLiveReleases();
    return () => {
      mounted = false;
    };
  }, []);

  const featuredReleases = useMemo(() => {
    const published = liveReleases
      .filter((release) => release.status === "available" && release.featured_on_landing)
      .sort((a, b) => {
        const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return (b.release_date ?? "").localeCompare(a.release_date ?? "");
      })
      .slice(0, 3)
      .map((release) => ({
        id: release.id,
        name: release.name,
        category: release.category ?? "General",
        img: release.editorial_image_url ?? release.image_url ?? "",
        date: release.release_date ?? "MMXXVI",
        note: release.handwritten_note ?? landingText.defaultNote,
      }));

    if (published.length > 0) return published;
    return releases.slice(0, 3);
  }, [landingText.defaultNote, liveReleases]);

  const latestNews = useMemo(() => {
    return liveReleases
      .filter((release) => release.status === "available")
      .sort((a, b) => {
        const dateDiff = (b.release_date ?? "").localeCompare(a.release_date ?? "");
        if (dateDiff !== 0) return dateDiff;
        return (a.display_order ?? 0) - (b.display_order ?? 0);
      })
      .map((release) => ({
        id: release.id,
        name: release.name,
        category: release.category ?? landingText.defaultCategory,
        description:
          release.short_description ??
          release.handwritten_note ??
          landingText.defaultDescription,
        img: release.editorial_image_url ?? release.image_url ?? "",
        date: release.release_date ?? "MMXXVI",
      }))[0];
  }, [landingText.defaultCategory, landingText.defaultDescription, liveReleases]);

  return (
    <main className="relative">
      {/* HERO */}
      <ScrollReveal as="section" variant="fade" className="relative overflow-hidden px-3 pt-6 md:px-6">
        <div className="relative mx-auto max-w-[1600px]">
          {/* huge headline behind image */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <h1 className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 font-display text-[22vw] leading-[0.85] tracking-tighter text-[var(--brand-ink)] md:text-[18vw]">
              {content.hero_headline_top}
            </h1>
            <h1 className="absolute left-1/2 top-[69%] -translate-x-1/2 -translate-y-1/2 font-display text-[22vw] leading-[0.85] tracking-tighter text-[var(--brand-ink)] md:text-[18vw]">
              {content.hero_headline_bottom}
            </h1>
          </div>

          {/* pink halo behind the figure */}
          <div
            className="pointer-events-none absolute left-1/2 top-[18%] z-[5] h-[42vw] w-[38vw] max-h-[680px] max-w-[620px] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in srgb, var(--brand-rose) 72%, white 28%) 0%, color-mix(in srgb, var(--brand-coral) 52%, white 48%) 42%, transparent 78%)",
              opacity: 0.34,
            }}
          />

          {/* image */}
          <ScrollReveal
            variant="scale"
            delay={140}
            className="relative z-10 mx-auto flex max-w-3xl justify-center pt-[8vw]"
          >
            {heroAssetUrl ? (
              <img
                src={heroAssetUrl}
                alt="Love Potion avatar"
                width={1536}
                height={1920}
                className="max-h-[76vh] w-[58vw] max-w-[680px] object-contain [filter:drop-shadow(0_0_24px_rgba(241,122,169,0.16))]"
              />
            ) : (
              <div className="aspect-[4/5] w-[58vw] max-w-[680px]" />
            )}
          </ScrollReveal>


          {/* vertical labels */}
          <div className="absolute left-3 top-32 z-30 hidden md:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-foreground/70 [writing-mode:vertical-rl] rotate-180">
              {content.hero_kicker}
            </p>
          </div>

          {/* edition mark top right */}
          <div className="absolute right-4 top-4 z-30 hidden md:block">
            <EditionMark />
          </div>

          {/* "the spell" handwritten */}
          <ScrollReveal
            variant="slide-left"
            delay={260}
            className="absolute right-[8.5%] top-[37%] z-30 hidden flex-col items-end md:flex xl:right-[8%]"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-[var(--brand-magenta)]">
              {landingText.sloganLabel}
            </span>
            <div className="mt-2">
              <HandwrittenNote withArrow>{content.hero_handwritten}</HandwrittenNote>
            </div>
          </ScrollReveal>

          {/* magenta X */}
          <div className="absolute right-[1.5%] top-[26%] z-30 hidden md:block xl:right-[1.25%]">
            <span className="font-display text-[8.4vw] leading-none text-[var(--brand-magenta)]">x</span>
          </div>

          {/* bottom CTA */}
          <ScrollReveal
            variant="fade-up"
            delay={340}
            className="relative z-30 mt-6 flex flex-col items-start gap-6 px-2 md:-mt-[4.5vw] md:flex-row md:items-end md:justify-between md:px-6"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                {landingText.firstTime}
              </div>
              <h2 className="mt-4 max-w-md font-display text-3xl leading-[1.05] md:text-4xl">
                {landingText.styleCast}
              </h2>
              <p className="mt-3 max-w-sm text-sm text-foreground/70">{content.hero_sub}</p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <div className="flex gap-2">
                <Link
                  to="/$lang/login"
                  params={{ lang }}
                  className="rounded-full bg-foreground px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]"
                >
                  {content.hero_cta_blogger}
                </Link>
                <Link
                  to="/$lang/apply"
                  params={{ lang }}
                  className="rounded-full border border-foreground/40 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] hover:bg-foreground hover:text-background"
                >
                  {content.hero_cta_apply}
                </Link>
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                <span>{t.hero.scroll}</span>
                <span className="block h-[1px] w-12 bg-foreground/50" />
                <span>↓</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </ScrollReveal>

      {/* NEWS WIDGET */}
      <ScrollReveal as="section" className="mt-16 px-6 md:px-12">
        <div className="mx-auto max-w-[1200px]">
          <Link
            to="/$lang/releases"
            params={{ lang }}
            className="glass group grid overflow-hidden rounded-[2rem] border border-[var(--brand-pink)] bg-[var(--brand-pink)]/65 shadow-[0_24px_70px_rgba(219,24,97,0.12)] md:grid-cols-[1fr_220px]"
          >
            <div className="flex flex-col justify-between gap-8 p-6 md:p-8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-foreground/60">
                  {landingText.newsKicker}
                </div>
                {loaded ? (
                  latestNews ? (
                    <>
                      <h2 className="mt-3 max-w-3xl font-display text-4xl leading-[0.95] md:text-5xl">
                        {latestNews.name}
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/70">
                        {latestNews.description}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="mt-3 max-w-3xl font-display text-4xl leading-[0.95] md:text-5xl">
                        {landingText.emptyNewsTitle}
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/70">
                        {landingText.emptyNewsBody}
                      </p>
                    </>
                  )
                ) : (
                  <>
                    <div className="mt-4 h-10 max-w-lg rounded-full bg-[var(--brand-pink)]/50" />
                    <div className="mt-4 h-4 max-w-xl rounded-full bg-[var(--brand-pink)]/40" />
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="rounded-full bg-foreground/90 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background transition group-hover:bg-[var(--brand-magenta)]">
                  {landingText.newsCta} →
                </span>
                {latestNews ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
                    {latestNews.category} · {latestNews.date}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="relative m-4 min-h-44 overflow-hidden rounded-2xl border border-background/50 md:min-h-0">
              {latestNews?.img ? (
                <img
                  src={latestNews.img}
                  alt={latestNews.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full min-h-48 items-center justify-center bg-[var(--brand-pink)]/55">
                  <span className="font-hand text-4xl text-[var(--brand-magenta)]">{landingText.soon}</span>
                </div>
              )}
            </div>
          </Link>
        </div>
      </ScrollReveal>

      {/* SOCIAL STRIP */}
      <ScrollReveal as="section" variant="scale" className="mt-24 px-6 md:px-12">
        <GlassCard tone="pink" className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {landingText.socialKicker}
            </div>
            <h3 className="mt-2 font-display text-3xl">{landingText.socialTitle}</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: t.socials.flickr, href: publicSocialLinks.flickr },
              { label: t.socials.primfeed, href: publicSocialLinks.primfeed },
              { label: t.socials.mp, href: publicSocialLinks.marketplace },
              { label: t.socials.fb, href: publicSocialLinks.facebook },
            ].map((social) => (
              <a
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-foreground/90 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]"
              >
                {social.label} →
              </a>
            ))}
          </div>
        </GlassCard>
      </ScrollReveal>

      {/* LATEST RELEASES TEASER */}
      <ScrollReveal as="section" className="mt-32 px-6 md:px-12">
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
            to="/$lang/releases"
            params={{ lang }}
            className="hidden rounded-full border border-foreground/40 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:bg-foreground hover:text-background md:inline-block"
          >
            {t.releases.cta} →
          </Link>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {featuredReleases.map((r, i) => (
            <div key={r.id} className={i === 1 ? "md:translate-y-12" : ""}>
              <ScrollReveal delay={i * 120}>
                <article className="group relative">
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
              </ScrollReveal>
            </div>
          ))}
        </div>
        {!loaded ? (
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/40">
            {landingText.syncing}
          </div>
        ) : null}
      </ScrollReveal>

      {/* EVENT LOGOS */}
      <ScrollReveal as="section" variant="fade-up" className="mt-32 px-6 pb-20 md:px-12 md:pb-28">
        <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[2.4rem] bg-[linear-gradient(145deg,#24131b_0%,#120d12_58%,#08070a_100%)] px-6 py-10 shadow-[0_28px_90px_rgba(27,9,17,0.38)] md:px-10 md:py-14">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/55">
                {landingText.eventsKicker}
              </div>
              <h3 className="mt-3 font-display text-4xl leading-none text-white md:text-[4.25rem]">
                {landingText.eventsTitle}
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/68">
                {landingText.eventsBody}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                key: "saturday-sale",
                name: "The Saturday Sale Weekend",
                src: tssWeekendLogo,
                imgClass: "max-h-[13rem] w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.22)]",
              },
              {
                key: "cosmospolitan",
                name: "Cosmopolitan Event",
                src: cosmopolitanLogo,
                imgClass: "max-h-[12.2rem] w-auto object-contain opacity-95 [filter:brightness(1.04)_drop-shadow(0_0_22px_rgba(255,244,208,0.12))]",
              },
              {
                key: "waifus-dream",
                name: "WAIFUS Dreams",
                src: waifuDreamsLogo,
                imgClass: "max-h-[12.8rem] w-auto object-contain drop-shadow-[0_14px_28px_rgba(76,18,64,0.22)]",
              },
            ].map((event) => (
              <div
                key={event.key}
                className="group relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] px-6 py-8 backdrop-blur-sm"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_56%)] opacity-60 transition duration-500 group-hover:opacity-100" />
                <div className="absolute inset-x-8 bottom-0 h-px bg-white/10" />
                <div className="relative flex min-h-[11rem] items-center justify-center text-center text-white">
                  <img
                    src={event.src}
                    alt={event.name}
                    loading="lazy"
                    className={event.imgClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </main>
  );
}
