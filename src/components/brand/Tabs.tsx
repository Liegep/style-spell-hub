import { cn } from "@/lib/utils";
import { useState } from "react";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] transition",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 text-foreground/70 hover:border-foreground/60 hover:text-foreground",
            )}
          >
            {tab.sub && <span className="mr-2 opacity-60">{tab.sub}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function useTabs<T extends string>(initial: T) {
  return useState<T>(initial);
}
