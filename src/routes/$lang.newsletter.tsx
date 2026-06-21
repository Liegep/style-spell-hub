import { createFileRoute } from "@tanstack/react-router";
import { useT } from "@/i18n/dict";
import { GlassCard } from "@/components/brand/GlassCard";
import release2 from "@/assets/release-2.jpg";
import { useSiteAssetUrl } from "@/hooks/use-site-asset";
import { useSiteContent } from "@/hooks/use-site-content";

export const Route = createFileRoute("/$lang/newsletter")({
  component: NewsletterPage,
});

function NewsletterPage() {
  const { t, lang } = useT();
  const newsletterAssetUrl = useSiteAssetUrl("newsletter_preview", release2);
  const content = useSiteContent(lang, {
    newsletter_title: t.newsletter.title,
    newsletter_kicker: t.newsletter.kicker,
    newsletter_placeholder: t.newsletter.placeholder,
    newsletter_cta: t.newsletter.cta,
    newsletter_preview: t.newsletter.preview,
    newsletter_sample_title: t.newsletter.sampleTitle,
    newsletter_sample_body: t.newsletter.sampleBody,
  });
  return (
    <main className="px-6 pt-16 md:px-12">
      <div className="mx-auto max-w-[1300px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          SUBSCRIBE · Nº 03
        </div>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] md:text-[7rem]">
          {content.newsletter_title}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-foreground/80">{content.newsletter_kicker}</p>

        <div className="mt-14 grid gap-10 md:grid-cols-2">
          {/* form */}
          <GlassCard tone="pink" className="flex flex-col gap-4 p-8">
            <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
              {content.newsletter_placeholder}
            </label>
            <input
              type="text"
              placeholder="Resident.Lastname"
              className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 font-mono text-sm placeholder:text-foreground/40 focus:border-[var(--brand-magenta)] focus:outline-none"
            />
            <button className="mt-2 rounded-full bg-foreground px-6 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
              {content.newsletter_cta} →
            </button>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              Free · in-world delivery · unsubscribe anytime
            </p>
          </GlassCard>

          {/* preview card */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {content.newsletter_preview}
            </div>
            <GlassCard className="mt-4 overflow-hidden p-0">
              {newsletterAssetUrl ? (
                <img
                  src={newsletterAssetUrl}
                  alt="newsletter preview"
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[4/3] w-full bg-[var(--brand-pink)]/50" />
              )}
              <div className="p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                  LOVE POTION · NEWS
                </div>
                <h3 className="mt-2 font-display text-2xl">{content.newsletter_sample_title}</h3>
                <p className="mt-2 text-sm text-foreground/75">{content.newsletter_sample_body}</p>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </main>
  );
}
