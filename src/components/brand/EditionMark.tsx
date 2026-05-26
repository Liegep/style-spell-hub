import { useT } from "@/i18n/dict";

export function EditionMark() {
  const { t } = useT();
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-foreground/70">
      {t.edition}
    </span>
  );
}
