import { useT } from "@/i18n/dict";

export function PublicFooter() {
  const { t } = useT();
  return (
    <footer className="mt-32 border-t border-foreground/10 px-6 py-12 md:px-12">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-display text-5xl leading-none">
            love potion<span className="text-[var(--brand-magenta)]">.</span>
          </div>
          <p className="font-hand mt-3 text-2xl text-[var(--brand-magenta)]">
            {t.slogan}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
          <a href="#" className="hover:text-foreground">{t.socials.flickr}</a>
          <span>·</span>
          <a href="#" className="hover:text-foreground">{t.socials.mp}</a>
          <span>·</span>
          <a href="#" className="hover:text-foreground">{t.socials.fb}</a>
        </div>
      </div>
      <div className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">
        © MMXXVI · LOVE POTION · ALL SPELLS RESERVED
      </div>
    </footer>
  );
}
