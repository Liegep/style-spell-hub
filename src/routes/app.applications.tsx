import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ApplicationFormBuilder } from "@/components/app/ApplicationFormBuilder";
import { ApplicationsPanel } from "@/components/app/ApplicationsPanel";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { translateAppPhrase } from "@/i18n/app-text";
import { useLang } from "@/i18n/dict";

export const Route = createFileRoute("/app/applications")({
  component: ApplicationsPage,
});

type ApplicationsTab = "queue" | "builder";

function ApplicationsPage() {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const [tab, setTab] = useState<ApplicationsTab>("queue");

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {tr("Love Potion · Applications")}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">
            {tr("Blogger applications.")}
          </h1>
        </div>
        <HandwrittenNote>{tr(tab === "queue" ? "review with care" : "ask beautifully")}</HandwrittenNote>
      </header>

      <div className="mt-8">
        <Tabs<ApplicationsTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "queue", label: tr("Review queue"), sub: "01" },
            { id: "builder", label: tr("Form builder"), sub: "02" },
          ]}
        />
      </div>

      <div className="mt-10">
        {tab === "queue" ? <ApplicationsPanel /> : <ApplicationFormBuilder />}
      </div>
    </div>
  );
}
