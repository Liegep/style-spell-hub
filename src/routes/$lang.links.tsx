import { createFileRoute } from "@tanstack/react-router";
import { Camera, ExternalLink, Facebook, Globe2, Heart, MessageCircle, ShoppingBag } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { useT } from "@/i18n/dict";
import { publicSocialLinks } from "@/lib/public-links";
import { useSiteAssetUrl } from "@/hooks/use-site-asset";

export const Route = createFileRoute("/$lang/links")({
  component: LinksPage,
});

function LinksPage() {
  const { lang } = useT();
  const logoAssetUrl = useSiteAssetUrl("logo_icon", logoIcon);
  const copy =
    lang === "es"
      ? {
          eyebrow: "LOVE POTION · LINKS",
          title: "Elige tu portal.",
          note: "todo juntito",
          intro: "Encuentra la tienda, el feed, las fotos y los espacios oficiales de Love Potion.",
          site: "Sitio oficial",
          siteSub: "Entra a lovepotion-sl.com",
          flickr: "Flickr",
          flickrSub: "Fotos, releases y magia visual",
          primfeed: "Primfeed",
          primfeedSub: "Noticias rápidas desde el grid",
          marketplace: "Marketplace",
          marketplaceSub: "Compra directa en Second Life",
          facebook: "Facebook",
          facebookSub: "Actualizaciones y comunidad",
          footer: "Love Potion · Second Life",
        }
      : {
          eyebrow: "LOVE POTION · LINKS",
          title: "Choose your portal.",
          note: "all together",
          intro: "Find the store, the feed, the photos, and every official Love Potion space.",
          site: "Official site",
          siteSub: "Open lovepotion-sl.com",
          flickr: "Flickr",
          flickrSub: "Photos, releases, and visual magic",
          primfeed: "Primfeed",
          primfeedSub: "Fresh updates from the grid",
          marketplace: "Marketplace",
          marketplaceSub: "Shop directly in Second Life",
          facebook: "Facebook",
          facebookSub: "Updates and community",
          footer: "Love Potion · Second Life",
        };

  const links = [
    { label: copy.site, sub: copy.siteSub, href: publicSocialLinks.site, icon: Globe2, tone: "dark" },
    { label: copy.flickr, sub: copy.flickrSub, href: publicSocialLinks.flickr, icon: Camera, tone: "light" },
    { label: copy.primfeed, sub: copy.primfeedSub, href: publicSocialLinks.primfeed, icon: MessageCircle, tone: "pink" },
    { label: copy.marketplace, sub: copy.marketplaceSub, href: publicSocialLinks.marketplace, icon: ShoppingBag, tone: "light" },
    { label: copy.facebook, sub: copy.facebookSub, href: publicSocialLinks.facebook, icon: Facebook, tone: "pink" },
  ] as const;

  return (
    <main className="px-5 py-12 md:px-10 md:py-16">
      <section className="mx-auto max-w-xl">
        <div className="text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-white/70 bg-[var(--brand-pink)]/70 shadow-[0_24px_70px_rgba(219,24,97,0.18)]">
            {logoAssetUrl ? (
              <img src={logoAssetUrl} alt="Love Potion" className="h-16 w-16 object-contain" />
            ) : (
              <Heart className="h-12 w-12 text-[var(--brand-magenta)]" />
            )}
          </div>
          <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--brand-magenta)]">
            {copy.eyebrow}
          </div>
          <h1 className="mt-3 font-display text-6xl leading-[0.9] text-[var(--ink)] md:text-7xl">
            {copy.title}
          </h1>
          <div className="mt-3 flex justify-center">
            <HandwrittenNote>{copy.note}</HandwrittenNote>
          </div>
          <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-foreground/65">{copy.intro}</p>
        </div>

        <GlassCard tone="pink" className="mt-10 space-y-3 rounded-[2rem] p-4 shadow-[0_24px_80px_rgba(219,24,97,0.14)]">
          {links.map((item) => {
            const Icon = item.icon;
            const isDark = item.tone === "dark";
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className={`group flex items-center gap-4 rounded-[1.25rem] border px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-xl ${
                  isDark
                    ? "border-foreground/10 bg-foreground text-background shadow-foreground/10 hover:bg-[var(--brand-magenta)]"
                    : "border-white/70 bg-background/75 text-foreground hover:border-[var(--brand-magenta)]/30 hover:bg-white/85"
                }`}
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                    isDark ? "bg-background/15 text-background" : "bg-[var(--brand-pink)] text-[var(--brand-magenta)]"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-2xl leading-none">{item.label}</span>
                  <span className={`mt-1 block text-xs leading-5 ${isDark ? "text-background/65" : "text-foreground/55"}`}>
                    {item.sub}
                  </span>
                </span>
                <ExternalLink className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${isDark ? "text-background/70" : "text-[var(--brand-magenta)]"}`} />
              </a>
            );
          })}
        </GlassCard>

        <div className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
          {copy.footer}
        </div>
      </section>
    </main>
  );
}
