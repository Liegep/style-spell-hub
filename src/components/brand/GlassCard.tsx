import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: "light" | "pink" | "dark";
}

export function GlassCard({ tone = "light", className, ...rest }: Props) {
  const toneClass =
    tone === "pink" ? "glass-pink" : tone === "dark" ? "glass-dark" : "glass";
  return (
    <div
      className={cn("rounded-2xl p-6 transition-all", toneClass, className)}
      {...rest}
    />
  );
}
