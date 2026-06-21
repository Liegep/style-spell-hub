import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import {
  getNotificationHealth,
  listAuditLogs,
  processSecondLifeNotificationsNow,
  type NotificationHealth,
  type NotificationQueueWithRecipient,
} from "@/integrations/supabase/audit-log";
import type { AuditLog, NotificationStatus } from "@/integrations/supabase/database.types";

export const Route = createFileRoute("/app/audit-log")({
  component: AuditLogPage,
});

function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notificationHealth, setNotificationHealth] = useState<NotificationHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [automationError, setAutomationError] = useState("");
  const [automationNotice, setAutomationNotice] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsLoading(true);
      setError("");
      try {
        const [rows, health] = await Promise.all([listAuditLogs(), getNotificationHealth()]);
        if (!cancelled) {
          setLogs(rows);
          setNotificationHealth(health);
        }
      } catch (loadError) {
        console.error("[Audit Log] Failed to load logs.", loadError);
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the audit log yet.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshHealth() {
    setNotificationHealth(await getNotificationHealth());
  }

  async function handleProcessNow() {
    setIsProcessing(true);
    setAutomationError("");
    setAutomationNotice("");
    try {
      const processed = await processSecondLifeNotificationsNow();
      setAutomationNotice(`${processed} notification${processed === 1 ? "" : "s"} processed.`);
      await refreshHealth();
    } catch (processError) {
      console.error("[Audit Log] Could not process Second Life queue.", processError);
      setAutomationError(formatActionError(processError));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            TEAM · AUDIT
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">
            The paper trail.
          </h1>
        </div>
        <HandwrittenNote>every spell, logged</HandwrittenNote>
      </header>

      <AutomationHealthPanel
        error={automationError}
        health={notificationHealth}
        isLoading={isLoading}
        isProcessing={isProcessing}
        notice={automationNotice}
        onProcessNow={handleProcessNow}
      />

      <GlassCard className="mt-10 p-0">
        {isLoading ? (
          <AuditEmpty title="loading the trail" subtitle="Gathering the latest atelier activity." />
        ) : error ? (
          <AuditEmpty title="audit table not ready" subtitle={error} />
        ) : logs.length === 0 ? (
          <AuditEmpty title="nothing logged yet" subtitle="Actions will appear here as the team works." />
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
  const state = getAutomationState(health);

  return (
    <section className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <GlassCard className="p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          AUTOMATIONS · SECOND LIFE
        </div>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-4xl leading-none text-[var(--ink)]">System pulse.</h2>
            <p className="mt-3 max-w-xl text-sm text-foreground/60">
              A quick health check for IM warnings, delivery nudges, and queued Second Life notices.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton disabled={isLoading || isProcessing} onClick={onProcessNow} tone="dark">
              {isProcessing ? "processing..." : "process now"}
            </ActionButton>
          </div>
        </div>

        <div className={`mt-6 rounded-2xl px-4 py-4 ${state.toneClass}`}>
          <div className="font-mono text-[9px] uppercase tracking-[0.28em]">{state.label}</div>
          <div className="mt-1 text-sm">{state.description}</div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <HealthStat label="pending" value={health?.counts.pending ?? 0} tone="pending" />
          <HealthStat label="sent" value={health?.counts.sent ?? 0} tone="sent" />
          <HealthStat label="failed" value={health?.counts.failed ?? 0} tone="failed" />
          <HealthStat label="due now" value={health?.duePending ?? 0} tone="due" />
        </div>

        <div className="mt-6 grid gap-3 border-t border-foreground/10 pt-5 text-sm text-foreground/60 md:grid-cols-2">
          <PulseLine
            label="Last processed"
            value={health?.latestProcessedAt ? formatFullDate(health.latestProcessedAt) : "No processing yet"}
          />
          <PulseLine
            label="Oldest due"
            value={health?.oldestDuePendingAt ? formatFullDate(health.oldestDuePendingAt) : "Nothing due right now"}
          />
          <PulseLine label="Last sent" value={health?.latestSentAt ? formatFullDate(health.latestSentAt) : "No sent notices yet"} />
          <PulseLine
            label="Last failure"
            value={health?.latestFailedAt ? formatFullDate(health.latestFailedAt) : "No failures on record"}
          />
        </div>

        {notice ? <div className="mt-5 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div> : null}
        {error ? <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
            LATEST SL QUEUE
          </div>
          <AuditPill>{health?.latest.length ?? 0} rows</AuditPill>
        </div>

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <MiniEmpty>loading queue</MiniEmpty>
          ) : !health || health.latest.length === 0 ? (
            <MiniEmpty>no queued notices yet</MiniEmpty>
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
    <div className={`rounded-2xl border border-white/70 px-4 py-4 shadow-[0_18px_45px_rgba(219,24,97,0.08)] backdrop-blur-xl ${toneClass}`}>
      <div className="font-display text-4xl leading-none">{value}</div>
      <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em]">{label}</div>
    </div>
  );
}

function PulseLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/40">{label}</div>
      <div className="mt-1 font-medium text-[var(--ink)]">{value}</div>
    </div>
  );
}

function NotificationQueueRow({ notification }: { notification: NotificationQueueWithRecipient }) {
  const scheduledLabel =
    notification.status === "sent" && notification.sent_at
      ? `sent ${formatDate(notification.sent_at)}`
      : `scheduled ${formatDate(notification.scheduled_at)}`;
  const recipientLabel = notification.recipientName ?? notification.recipientAvatarName ?? notification.recipient_sl_uuid;

  return (
    <div className="rounded-2xl border border-foreground/10 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {recipientLabel ? (
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
              To · {recipientLabel}
            </div>
          ) : null}
          <div className="font-display text-lg leading-tight text-[var(--ink)]">{notification.title}</div>
          <div className="mt-1 line-clamp-2 text-sm text-foreground/60">{notification.body}</div>
        </div>
        <StatusPill status={notification.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/40">
        <span>{humanize(notification.type)}</span>
        <span>{formatDate(notification.created_at)}</span>
        <span>{scheduledLabel}</span>
        {notification.attempts > 0 ? <span>{notification.attempts} tries</span> : null}
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
    <span className={`shrink-0 rounded-full px-3 py-1 font-mono text-[8px] uppercase tracking-[0.25em] ${toneClass}`}>
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

function getAutomationState(health: NotificationHealth | null) {
  if (!health) {
    return {
      description: "Loading the Second Life queue and recent notification history.",
      label: "Checking queue",
      toneClass: "bg-foreground/5 text-foreground/55",
    };
  }

  if (health.counts.failed > 0) {
    return {
      description: "Some Second Life notices failed. Open the latest queue list and check the error message before retrying.",
      label: "Needs attention",
      toneClass: "bg-red-50 text-red-600",
    };
  }

  if (health.duePending > 0) {
    return {
      description: `${health.duePending} notice${health.duePending === 1 ? " is" : "s are"} due now. Use Process Now if you want to push the queue immediately.`,
      label: "Ready to process",
      toneClass: "bg-amber-50 text-amber-700",
    };
  }

  if (health.counts.pending > 0) {
    return {
      description: "There are scheduled notices waiting for their time. No manual action needed.",
      label: "Waiting on schedule",
      toneClass: "bg-[var(--brand-blush)] text-[var(--brand-magenta)]",
    };
  }

  return {
    description: "No pending Second Life notices and no failures on record. Everything is quiet.",
    label: "All clear",
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
  return (
    <li className="border-b border-foreground/5 px-6 py-5 last:border-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
            {formatDate(log.created_at)} · {log.actor_name ?? "System"}
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatActionError(error: unknown) {
  return error instanceof Error ? error.message : "Could not complete the automation action.";
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}
