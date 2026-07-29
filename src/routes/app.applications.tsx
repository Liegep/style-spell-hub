import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ApplicationFormBuilder } from "@/components/app/ApplicationFormBuilder";
import { ApplicationsPanel } from "@/components/app/ApplicationsPanel";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { listApplicationFormFields, getBloggerAdmissionsSettings } from "@/integrations/supabase/application-form";
import { listBloggerApplications } from "@/integrations/supabase/applications";
import type { ApplicationFormField, BloggerApplication } from "@/integrations/supabase/database.types";
import { translateAppPhrase } from "@/i18n/app-text";
import { useLang } from "@/i18n/dict";

export const Route = createFileRoute("/app/applications")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    status:
      search.status === "approved" || search.status === "rejected" || search.status === "all"
        ? search.status
        : "pending",
    applicationId: typeof search.applicationId === "string" ? search.applicationId : undefined,
    onboarding: search.onboarding === "created" ? "created" : undefined,
  }),
  loader: async ({ location }) => {
    const search = location.search as {
      status?: "pending" | "approved" | "rejected" | "all";
    };
    const [applicationsResult, fieldsResult, settingsResult] = await Promise.allSettled([
      listBloggerApplications(search.status ?? "pending"),
      listApplicationFormFields({ includeDisabled: true }),
      getBloggerAdmissionsSettings(),
    ]);

    const fields = fieldsResult.status === "fulfilled" ? fieldsResult.value : [];

    return {
      applications: applicationsResult.status === "fulfilled" ? applicationsResult.value : ([] as BloggerApplication[]),
      applicationsError:
        applicationsResult.status === "rejected"
          ? applicationsResult.reason instanceof Error
            ? applicationsResult.reason.message
            : "Could not load applications."
          : "",
      formFields: fields as ApplicationFormField[],
      formError:
        fieldsResult.status === "rejected"
          ? fieldsResult.reason instanceof Error
            ? fieldsResult.reason.message
            : "Could not load application form."
          : "",
      admissionsSettings:
        settingsResult.status === "fulfilled"
          ? settingsResult.value
          : {
              open: true,
              rulesText: "",
            },
    };
  },
  component: ApplicationsPage,
});

type ApplicationsTab = "queue" | "builder";

function ApplicationsPage() {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const initialData = Route.useLoaderData();
  const search = Route.useSearch();
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
        {tab === "queue" ? (
          <ApplicationsPanel
            initialApplications={initialData.applications}
            initialFormFields={initialData.formFields}
            initialError={initialData.applicationsError}
            initialFilter={search.status}
            initialSelectedId={search.applicationId}
            initialOnboardingState={search.onboarding}
          />
        ) : (
          <ApplicationFormBuilder
            initialFields={initialData.formFields}
            initialSettings={initialData.admissionsSettings}
            initialError={initialData.formError}
          />
        )}
      </div>
    </div>
  );
}
