import { useLocation, useNavigate } from "@tanstack/react-router";
import { useLang } from "@/i18n/dict";
import { cn } from "@/lib/utils";

export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang();
  const loc = useLocation();
  const navigate = useNavigate();

  const switchTo = (target: "en" | "es") => {
    const current = loc.pathname;
    // Replace the lang segment if present
    const replaced = current.replace(/^\/(en|es)(\/|$)/, `/${target}$2`);
    const next = replaced === current && !/^\/(en|es)/.test(current)
      ? `/${target}`
      : replaced;
    navigate({ to: next, replace: true });
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.3em]",
        className,
      )}
    >
      <button
        onClick={() => switchTo("en")}
        className={cn(
          "rounded-full px-2 py-1 transition",
          lang === "en"
            ? "bg-foreground text-background"
            : "text-foreground/60 hover:text-foreground",
        )}
      >
        EN
      </button>
      <span className="text-foreground/30">/</span>
      <button
        onClick={() => switchTo("es")}
        className={cn(
          "rounded-full px-2 py-1 transition",
          lang === "es"
            ? "bg-foreground text-background"
            : "text-foreground/60 hover:text-foreground",
        )}
      >
        ES
      </button>
    </div>
  );
}
