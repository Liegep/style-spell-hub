import { cn } from "@/lib/utils";

export function VerticalLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-vertical font-mono text-[10px] uppercase tracking-[0.35em] text-foreground/70",
        className,
      )}
    >
      {children}
    </span>
  );
}
