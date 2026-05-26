import { Link, useLocation } from "@tanstack/react-router";
import { useLang } from "@/i18n/dict";
import { cn } from "@/lib/utils";

export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang();
  const loc = useLocation();
  const rest = loc.pathname.replace(/^\/(en|es)/, "") || "/";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.3em]",
        className,
      )}
    >
      <Link
        to={`/en${rest === "/" ? "" : rest}` as string}
        className={cn(
          "rounded-full px-2 py-1 transition",
          lang === "en"
            ? "bg-foreground text-background"
            : "text-foreground/60 hover:text-foreground",
        )}
      >
        EN
      </Link>
      <span className="text-foreground/30">/</span>
      <Link
        to={`/es${rest === "/" ? "" : rest}` as string}
        className={cn(
          "rounded-full px-2 py-1 transition",
          lang === "es"
            ? "bg-foreground text-background"
            : "text-foreground/60 hover:text-foreground",
        )}
      >
        ES
      </Link>
    </div>
  );
}
