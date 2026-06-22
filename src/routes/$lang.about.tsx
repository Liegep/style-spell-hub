import { createFileRoute } from "@tanstack/react-router";
import aboutImg from "@/assets/about-editorial.jpg";
import { useT } from "@/i18n/dict";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { useSiteAssetUrl } from "@/hooks/use-site-asset";
import { useSiteContent } from "@/hooks/use-site-content";

export const Route = createFileRoute("/$lang/about")({
  component: AboutPage,
});

function AboutPage() {
  const { t, lang } = useT();
  const aboutAssetUrl = useSiteAssetUrl("about_editorial", aboutImg);
  const content = useSiteContent(lang, {
    about_kicker: t.about.kicker,
    about_title: t.about.title,
    about_note: t.about.note,
    about_caption: t.about.caption,
    about_body1: t.about.body1,
    about_body2: t.about.body2,
    about_pull: t.about.pull,
  });
  return (
    <main className="px-6 pt-16 md:px-12">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              {content.about_kicker}
            </div>
            <h1 className="mt-3 font-display text-6xl leading-[0.9] md:text-[9rem]">
              {content.about_title}
            </h1>
          </div>
          <div className="hidden md:block">
            <HandwrittenNote withArrow>{content.about_note}</HandwrittenNote>
          </div>
        </div>

        <div className="mt-16 grid items-start gap-10 md:grid-cols-12">
          <div className="md:col-span-6">
            {aboutAssetUrl ? (
              <img
                src={aboutAssetUrl}
                alt="Love Potion editorial"
                loading="lazy"
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="aspect-[4/3] w-full rounded-2xl bg-[var(--brand-pink)]/50" />
            )}
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {content.about_caption}
            </p>
          </div>
          <div className="md:col-span-6 md:pl-6">
            <p className="font-display text-2xl leading-snug md:text-3xl">{content.about_body1}</p>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-foreground/80">
              {content.about_body2}
            </p>
            <blockquote className="mt-12 border-l-2 border-[var(--brand-magenta)] pl-6">
              <p className="font-hand text-5xl leading-none text-[var(--brand-magenta)]">
                {content.about_pull}
              </p>
            </blockquote>
          </div>
        </div>
      </div>
    </main>
  );
}
