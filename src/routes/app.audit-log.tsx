import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import {
  getNotificationHealth,
  listSecondLifeDropboxes,
  listAuditLogs,
  processSecondLifeNotificationsInBatches,
  type NotificationHealth,
  type NotificationQueueWithRecipient,
} from "@/integrations/supabase/audit-log";
import { getCurrentProfile, type AuthProfile } from "@/integrations/supabase/auth";
import type {
  AuditLog,
  NotificationStatus,
  SecondLifeDropbox,
} from "@/integrations/supabase/database.types";
import { translateAppPhrase } from "@/i18n/app-text";
import { useLang } from "@/i18n/dict";

export const Route = createFileRoute("/app/audit-log")({
  ssr: false,
  loader: async () => {
    let currentProfile: AuthProfile | null = null;
    let logs: AuditLog[] = [];
    let notificationHealth: NotificationHealth | null = null;
    let dropboxes: SecondLifeDropbox[] = [];
    let error = "";
    let dropboxError = "";

    try {
      const [profile, rows, health] = await Promise.all([
        getCurrentProfile(),
        listAuditLogs(),
        getNotificationHealth(),
      ]);
      currentProfile = profile;
      logs = rows;
      notificationHealth = health;

      if (profile?.role === "super_admin") {
        try {
          dropboxes = await listSecondLifeDropboxes();
        } catch (dropboxLoadError) {
          dropboxError =
            dropboxLoadError instanceof Error
              ? dropboxLoadError.message
              : "Could not load Second Life dropboxes.";
        }
      }
    } catch (loadError) {
      error = loadError instanceof Error ? loadError.message : "Could not load the audit log yet.";
    }

    return {
      currentProfile,
      dropboxes,
      dropboxError,
      error,
      logs,
      notificationHealth,
    };
  },
  component: AuditLogPage,
});

function AuditLogPage() {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const initialData = Route.useLoaderData();
  const [logs] = useState<AuditLog[]>(initialData.logs);
  const [notificationHealth, setNotificationHealth] = useState<NotificationHealth | null>(
    initialData.notificationHealth,
  );
  const [isLoading] = useState(false);
  const [error] = useState(initialData.error ? tr(initialData.error) : "");
  const [automationError, setAutomationError] = useState("");
  const [automationNotice, setAutomationNotice] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProfile] = useState<AuthProfile | null>(initialData.currentProfile);
  const [dropboxes] = useState<SecondLifeDropbox[]>(initialData.dropboxes);
  const [dropboxError] = useState(initialData.dropboxError);

  async function refreshHealth() {
    setNotificationHealth(await getNotificationHealth());
  }

  async function handleProcessNow() {
    setIsProcessing(true);
    setAutomationError("");
    setAutomationNotice("");
    try {
      const processed = await processSecondLifeNotificationsInBatches({
        batchSize: 5,
        maxBatches: 10,
      });
      setAutomationNotice(
        processed === 1
          ? `1 ${tr("notification processed.")}`
          : `${processed} ${tr("notifications processed.")}`,
      );
      await refreshHealth();
    } catch (processError) {
      console.error("[Audit Log] Could not process Second Life queue.", processError);
      setAutomationError(formatActionError(processError, tr));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {tr("TEAM · AUDIT")}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">
            {tr("The paper trail.")}
          </h1>
        </div>
        <HandwrittenNote>{tr("every spell, logged")}</HandwrittenNote>
      </header>

      <AutomationHealthPanel
        error={automationError}
        health={notificationHealth}
        isLoading={isLoading}
        isProcessing={isProcessing}
        notice={automationNotice}
        onProcessNow={handleProcessNow}
      />

      {currentProfile?.role === "super_admin" ? (
        <SecondLifeDropboxesPanel
          dropboxes={dropboxes}
          error={dropboxError}
          isLoading={isLoading}
        />
      ) : null}

      <GlassCard className="mt-10 p-0">
        {isLoading ? (
          <AuditEmpty
            title={tr("loading the trail")}
            subtitle={tr("Gathering the latest atelier activity.")}
          />
        ) : error ? (
          <AuditEmpty title={tr("audit table not ready")} subtitle={error} />
        ) : logs.length === 0 ? (
          <AuditEmpty
            title={tr("nothing logged yet")}
            subtitle={tr("Actions will appear here as the team works.")}
          />
        ) : (
          <ul>
            {logs.map((log) => (
              <AuditRow key={log.id} log={log} />
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function AutomationHealthPanel({
  error,
  health,
  isLoading,
  isProcessing,
  notice,
  onProcessNow,
}: {
  error: string;
  health: NotificationHealth | null;
  isLoading: boolean;
  isProcessing: boolean;
  notice: string;
  onProcessNow: () => void;
}) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const state = getAutomationState(health, tr);

  return (
    <section className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <GlassCard className="p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          {tr("AUTOMATIONS · SECOND LIFE")}
        </div>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-4xl leading-none text-[var(--ink)]">
              {tr("System pulse.")}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-foreground/60">
              {tr(
                "A quick health check for IM warnings, delivery nudges, and queued Second Life notices.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton disabled={isLoading || isProcessing} onClick={onProcessNow} tone="dark">
              {isProcessing ? tr("processing...") : tr("Process now")}
            </ActionButton>
          </div>
        </div>

        <div className={`mt-6 rounded-2xl px-4 py-4 ${state.toneClass}`}>
          <div className="font-mono text-[9px] uppercase tracking-[0.28em]">{state.label}</div>
          <div className="mt-1 text-sm">{state.description}</div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <HealthStat label={tr("pending")} value={health?.counts.pending ?? 0} tone="pending" />
          <HealthStat label={tr("sent")} value={health?.counts.sent ?? 0} tone="sent" />
          <HealthStat label={tr("failed")} value={health?.counts.failed ?? 0} tone="failed" />
          <HealthStat label={tr("Due now")} value={health?.duePending ?? 0} tone="due" />
        </div>

        <div className="mt-6 grid gap-3 border-t border-foreground/10 pt-5 text-sm text-foreground/60 md:grid-cols-2">
          <PulseLine
            label={tr("Last processed")}
            value={
              health?.latestProcessedAt
                ? formatFullDate(health.latestProcessedAt, language)
                : tr("No processing yet")
            }
          />
          <PulseLine
            label={tr("Oldest due")}
            value={
              health?.oldestDuePendingAt
                ? formatFullDate(health.oldestDuePendingAt, language)
                : tr("Nothing due right now")
            }
          />
          <PulseLine
            label={tr("Last sent")}
            value={
              health?.latestSentAt
                ? formatFullDate(health.latestSentAt, language)
                : tr("No sent notices yet")
            }
          />
          <PulseLine
            label={tr("Last failure")}
            value={
              health?.latestFailedAt
                ? formatFullDate(health.latestFailedAt, language)
                : tr("No failures on record")
            }
          />
        </div>

        {notice ? (
          <div className="mt-5 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : null}
      </GlassCard>

      <GlassCard className="p-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
            {tr("LATEST SL QUEUE")}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <MiniEmpty>{tr("loading queue")}</MiniEmpty>
          ) : !health || health.latest.length === 0 ? (
            <MiniEmpty>{tr("no queued notices yet")}</MiniEmpty>
          ) : (
            health.latest.map((notification) => (
              <NotificationQueueRow key={notification.id} notification={notification} />
            ))
          )}
        </div>
      </GlassCard>
    </section>
  );
}

function SecondLifeDropboxesPanel({
  dropboxes,
  error,
  isLoading,
}: {
  dropboxes: SecondLifeDropbox[];
  error: string;
  isLoading: boolean;
}) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  return (
    <GlassCard className="mt-10 p-6">
      <div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {tr("SECOND LIFE · DROPBOXES")}
          </div>
          <h2 className="mt-2 font-display text-4xl leading-none text-[var(--ink)]">
            {tr("Delivery dropboxes.")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-foreground/60">
            {tr(
              "Registered in-world prims that can deliver products, textures, and Second Life notices for Love Potion.",
            )}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-[var(--brand-magenta)]/40 bg-white/60 px-4 py-3 text-sm text-[var(--brand-magenta)]">
          {error.includes("list_second_life_dropboxes")
            ? tr("Run the latest Supabase migration to enable the dropbox list.")
            : tr(error)}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <MiniEmpty>{tr("loading dropboxes")}</MiniEmpty>
        ) : dropboxes.length === 0 ? (
          <MiniEmpty>{tr("no dropboxes registered yet")}</MiniEmpty>
        ) : (
          dropboxes.map((dropbox) => <DropboxCard key={dropbox.id} dropbox={dropbox} />)
        )}
      </div>
    </GlassCard>
  );
}

function DropboxCard({ dropbox }: { dropbox: SecondLifeDropbox }) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const connected = dropbox.active && Boolean(dropbox.server_url);
  const label = connected ? tr("connected") : tr("disconnected");
  const statusClass = connected ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600";

  return (
    <div className="rounded-3xl border border-white/70 bg-white/45 p-5 shadow-[0_18px_45px_rgba(219,24,97,0.08)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display text-2xl leading-tight text-[var(--ink)]">
            {dropbox.object_name || tr("Second Life Dropbox")}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/45">
            <span>{dropbox.region_name || tr("Region unknown")}</span>
            <span>{dropbox.id}</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-mono text-[8px] uppercase tracking-[0.25em] ${statusClass}`}
        >
          {label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-foreground/60 md:grid-cols-2">
        <PulseLine
          label={tr("Last registered")}
          value={formatFullDate(dropbox.last_seen_at, language)}
        />
        <PulseLine label={tr("Updated")} value={formatFullDate(dropbox.updated_at, language)} />
        <PulseLine label={tr("Object key")} value={shortenKey(dropbox.object_key, tr)} />
        <PulseLine label={tr("Owner key")} value={shortenKey(dropbox.owner_key, tr)} />
      </div>

      <div className="mt-4 rounded-2xl bg-white/60 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/45">
        {shortenUrl(dropbox.server_url)}
      </div>
    </div>
  );
}

function HealthStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "pending" | "sent" | "failed" | "due";
  value: number;
}) {
  const toneClass = {
    due: "bg-[var(--brand-blush)]/85 text-[var(--brand-magenta)]",
    failed: "bg-red-50/85 text-red-600",
    pending: "bg-amber-50/85 text-amber-700",
    sent: "bg-green-50/85 text-green-700",
  }[tone];

  return (
    <div
      className={`rounded-2xl border border-white/70 px-4 py-4 shadow-[0_18px_45px_rgba(219,24,97,0.08)] backdrop-blur-xl ${toneClass}`}
    >
      <div className="font-display text-4xl leading-none">{value}</div>
      <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em]">{label}</div>
    </div>
  );
}

function PulseLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/40">
        {label}
      </div>
      <div className="mt-1 font-medium text-[var(--ink)]">{value}</div>
    </div>
  );
}

function NotificationQueueRow({ notification }: { notification: NotificationQueueWithRecipient }) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const scheduledLabel =
    notification.status === "sent" && notification.sent_at
      ? `${tr("sent")} ${formatDate(notification.sent_at, language)}`
      : `${tr("scheduled")} ${formatDate(notification.scheduled_at, language)}`;
  const recipientLabel =
    notification.recipientName ??
    notification.recipientAvatarName ??
    notification.recipient_sl_uuid;

  return (
    <div className="rounded-2xl border border-foreground/10 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {recipientLabel ? (
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
              {tr("To")} · {recipientLabel}
            </div>
          ) : null}
          <div className="font-display text-lg leading-tight text-[var(--ink)]">
            {notification.title}
          </div>
          <div className="mt-1 line-clamp-2 text-sm text-foreground/60">{notification.body}</div>
        </div>
        <StatusPill status={notification.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/40">
        <span>{humanize(notification.type)}</span>
        <span>{formatDate(notification.created_at, language)}</span>
        <span>{scheduledLabel}</span>
        {notification.attempts > 0 ? (
          <span>
            {notification.attempts} {tr("tries")}
          </span>
        ) : null}
      </div>
      {notification.last_error ? (
        <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
          {notification.last_error}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: NotificationStatus }) {
  const toneClass = {
    cancelled: "bg-foreground/5 text-foreground/45",
    failed: "bg-red-50 text-red-600",
    pending: "bg-amber-50 text-amber-700",
    sent: "bg-green-50 text-green-700",
  }[status];

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 font-mono text-[8px] uppercase tracking-[0.25em] ${toneClass}`}
    >
      {humanize(status)}
    </span>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone = "light",
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  tone?: "dark" | "light";
}) {
  const toneClass =
    tone === "dark"
      ? "bg-[var(--brand-magenta)] text-white shadow-lg shadow-[var(--brand-magenta)]/20 hover:bg-foreground disabled:bg-[var(--brand-magenta)] disabled:text-white disabled:opacity-75 disabled:shadow-none"
      : "border border-[var(--brand-pink)]/50 bg-white/55 text-[var(--brand-magenta)] disabled:border-foreground/10 disabled:bg-white/35 disabled:text-foreground/35";

  return (
    <button
      className={`rounded-full px-5 py-3 font-mono text-[9px] uppercase tracking-[0.25em] transition disabled:cursor-not-allowed ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function getAutomationState(health: NotificationHealth | null, tr: (value: string) => string) {
  if (!health) {
    return {
      description: tr("Loading the Second Life queue and recent notification history."),
      label: tr("Checking queue"),
      toneClass: "bg-foreground/5 text-foreground/55",
    };
  }

  if (health.counts.failed > 0) {
    return {
      description: tr(
        "Some Second Life notices failed. Open the latest queue list and check the error message before retrying.",
      ),
      label: tr("Needs attention"),
      toneClass: "bg-red-50 text-red-600",
    };
  }

  if (health.duePending > 0) {
    return {
      description:
        health.duePending === 1
          ? `1 ${tr("notice is due now. Use Process Now if you want to push the queue immediately.")}`
          : `${health.duePending} ${tr("notices are due now. Use Process Now if you want to push the queue immediately.")}`,
      label: tr("Ready to process"),
      toneClass: "bg-amber-50 text-amber-700",
    };
  }

  if (health.counts.pending > 0) {
    return {
      description: tr(
        "There are scheduled notices waiting for their time. No manual action needed.",
      ),
      label: tr("Waiting on schedule"),
      toneClass: "bg-[var(--brand-blush)] text-[var(--brand-magenta)]",
    };
  }

  return {
    description: tr(
      "No pending Second Life notices and no failures on record. Everything is quiet.",
    ),
    label: tr("All clear"),
    toneClass: "bg-green-50 text-green-700",
  };
}

function MiniEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-foreground/15 px-4 py-8 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/35">
      {children}
    </div>
  );
}

function AuditRow({ log }: { log: AuditLog }) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  return (
    <li className="border-b border-foreground/5 px-6 py-5 last:border-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
            {formatDate(log.created_at, language)} · {log.actor_name ?? tr("System")}
          </div>
          <div className="mt-2 font-display text-2xl leading-tight text-[var(--ink)]">
            {log.action}
          </div>
          {log.target_name ? (
            <div className="mt-2 text-sm text-foreground/60">
              {log.target_type ? `${humanize(log.target_type)} · ` : ""}
              {log.target_name}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {log.actor_role ? <AuditPill>{humanize(log.actor_role)}</AuditPill> : null}
          {log.target_type ? <AuditPill>{humanize(log.target_type)}</AuditPill> : null}
        </div>
      </div>
    </li>
  );
}

function AuditEmpty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
      <HandwrittenNote>{title}</HandwrittenNote>
      <p className="mt-4 max-w-md font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
        {subtitle}
      </p>
    </div>
  );
}

function AuditPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--brand-blush)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
      {children}
    </span>
  );
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "es" ? "es" : "en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFullDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "es" ? "es" : "en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatActionError(error: unknown, tr: (value: string) => string) {
  return error instanceof Error ? error.message : tr("Could not complete the automation action.");
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

function shortenKey(value: string | null, tr: (value: string) => string) {
  if (!value) return tr("not provided");
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function shortenUrl(value: string) {
  try {
    const url = new URL(value);
    const pathname = url.pathname.length > 22 ? `${url.pathname.slice(0, 22)}...` : url.pathname;
    return `${url.hostname}${pathname}`;
  } catch {
    return value.length > 44 ? `${value.slice(0, 44)}...` : value;
  }
}
