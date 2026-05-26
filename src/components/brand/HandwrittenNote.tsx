import { cn } from "@/lib/utils";

export function HandwrittenNote({
  children,
  className,
  withArrow = false,
}: {
  children: React.ReactNode;
  className?: string;
  withArrow?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex items-end gap-1", className)}>
      <span
        className="font-hand text-3xl leading-none"
        style={{ color: "var(--brand-magenta)" }}
      >
        {children}
      </span>
      {withArrow && (
        <svg
          viewBox="0 0 60 60"
          className="h-10 w-10 -mb-1"
          fill="none"
          stroke="var(--brand-magenta)"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M5 50 C 20 20, 35 15, 55 8" />
          <path d="M50 5 L 55 8 L 52 14" />
        </svg>
      )}
    </span>
  );
}
