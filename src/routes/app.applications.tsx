import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ApplicationFormBuilder } from "@/components/app/ApplicationFormBuilder";
import { ApplicationsPanel } from "@/components/app/ApplicationsPanel";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";

export const Route = createFileRoute("/app/applications")({
  component: ApplicationsPage,
});

type ApplicationsTab = "queue" | "builder";

function ApplicationsPage() {
  const [tab, setTab] = useState<ApplicationsTab>("queue");

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            LOVE POTION · APPLICATIONS
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">
            Blogger applications.
          </h1>
        </div>
        <HandwrittenNote>{tab === "queue" ? "review with care" : "ask beautifully"}</HandwrittenNote>
      </header>

      <div className="mt-8">
        <Tabs<ApplicationsTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "queue", label: "Review queue", sub: "01" },
            { id: "builder", label: "Form builder", sub: "02" },
          ]}
        />
      </div>

      <div className="mt-10">
        {tab === "queue" ? <ApplicationsPanel /> : <ApplicationFormBuilder />}
      </div>
    </div>
  );
}
