import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { translateAppPhrase } from "@/i18n/app-text";
import { useLang } from "@/i18n/dict";
import { cn } from "@/lib/utils";
import {
  createBloggerAccount,
  getBloggerDossier,
  listBloggers,
  removeBloggerAccount,
  updateBloggerDetails,
  updateBloggerAccountStatus,
  type BloggerDossier,
  type BloggerListItem,
} from "@/integrations/supabase/bloggers-admin";
import type { AccountStatus, AvailabilityStatus, BloggerTier } from "@/integrations/supabase/database.types";
import { notifySecondLifeQuietly } from "@/integrations/supabase/messages";

type BloggerFilter = "all" | "active" | "friends" | "blocked" | "vacation" | "missing_uuid";

export const Route = createFileRoute("/app/bloggers")({
  ssr: false,
  loader: async () => {
    try {
      return {
        rows: await listBloggers(),
        error: "",
      };
    } catch (error) {
      return {
        rows: [] as BloggerListItem[],
        error: error instanceof Error ? error.message : "Could not load bloggers.",
      };
    }
  },
  component: BloggersPage,
});

function BloggersPage() {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const initialData = Route.useLoaderData();
  const [filter, setFilter] = useState<BloggerFilter>("active");
  const [rows, setRows] = useState<BloggerListItem[]>(initialData.rows);
  const [state, setState] = useState<"loading" | "ready" | "error">(initialData.error ? "error" : "ready");
  const [errorMessage, setErrorMessage] = useState(initialData.error);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBlogger, setSelectedBlogger] = useState<BloggerListItem | null>(null);
  const [statusAction, setStatusAction] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});

  async function loadRows() {
    setState("loading");
    setErrorMessage("");
    try {
      const data = await listBloggers();
      setRows(data);
      setState("ready");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not load bloggers.");
    }
  }

  useEffect(() => {
    const onBloggersUpdated = () => void loadRows();
    window.addEventListener("bloggers-updated", onBloggersUpdated);
    window.addEventListener("focus", onBloggersUpdated);

    return () => {
      window.removeEventListener("bloggers-updated", onBloggersUpdated);
      window.removeEventListener("focus", onBloggersUpdated);
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((blogger) => {
      if (filter === "all") return blogger.account_status !== "left";
      if (filter === "active") return blogger.account_status === "active";
      if (filter === "friends") return blogger.blogger_tier === "friend" && blogger.account_status !== "left";
      if (filter === "blocked") return blogger.account_status === "blocked" || blogger.account_status === "left";
      if (filter === "vacation") return blogger.availability_status === "vacation" && blogger.account_status !== "left";
      if (filter === "missing_uuid") return !blogger.sl_avatar_uuid && blogger.account_status !== "left";
      return true;
    });
  }, [filter, rows]);

  async function reactivateBlogger(blogger: BloggerListItem) {
    setStatusAction((current) => ({ ...current, [blogger.id]: "saving" }));
    try {
      const updated = await updateBloggerAccountStatus(blogger.id, "active");
      setRows((current) => current.map((row) => (row.id === blogger.id ? updated : row)));
      void notifySecondLifeQuietly(
        {
          recipientId: blogger.id,
          type: "account_reactivated",
          title: "Love Potion access reactivated",
          body: "Your blogger account is active again. You can claim products and submit links in the Love Potion dashboard.",
        },
        "Account reactivation notification",
      );
      setStatusAction((current) => ({ ...current, [blogger.id]: "saved" }));
      window.setTimeout(() => {
        setStatusAction((current) => ({ ...current, [blogger.id]: "idle" }));
      }, 1800);
    } catch (error) {
      console.error("[Bloggers] Could not reactivate blogger", error);
      setStatusAction((current) => ({ ...current, [blogger.id]: "error" }));
    }
  }

  function replaceBlogger(updated: BloggerListItem) {
    setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    setSelectedBlogger(updated);
  }

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {tr("SUPER ADMIN · BLOGGERS")}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">{tr("The bloggers.")}</h1>
        </div>
        <HandwrittenNote>{tr("your circle")}</HandwrittenNote>
      </header>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs<BloggerFilter>
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: "all", label: tr("All bloggers"), sub: "01" },
            { id: "active", label: tr("Active"), sub: "02" },
            { id: "friends", label: tr("Friends"), sub: "03" },
            { id: "blocked", label: tr("Blocked / Removed"), sub: "04" },
            { id: "vacation", label: tr("Vacation"), sub: "05" },
            { id: "missing_uuid", label: tr("Missing UUID"), sub: "06" },
          ]}
        />
        <button
          onClick={() => setIsCreateOpen(true)}
          className="rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white shadow-lg shadow-[var(--brand-magenta)]/20 hover:opacity-90"
        >
          + {tr("Create blogger")}
        </button>
      </div>

      {state === "loading" ? (
        <GlassCard tone="pink" className="mt-10 p-8">
          <div className="font-hand text-3xl text-[var(--brand-magenta)]">{tr("loading bloggers...")}</div>
        </GlassCard>
      ) : null}

      {state === "error" ? (
        <GlassCard tone="pink" className="mt-10 p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {tr("Could not load")}
          </div>
          <p className="mt-3 text-sm text-foreground/80">{tr(errorMessage)}</p>
          <button
            onClick={() => void loadRows()}
            className="mt-4 rounded-full bg-foreground px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background"
          >
            {tr("Retry")}
          </button>
        </GlassCard>
      ) : null}

      {state === "ready" ? (
        <section className="mt-10 grid gap-4">
          {filtered.map((blogger) => (
            <GlassCard
              key={blogger.id}
              className={cn(
                "grid gap-5 p-5 xl:grid-cols-[1.15fr_0.75fr_1.15fr_auto] xl:items-center",
                (blogger.account_status === "blocked" || blogger.account_status === "left") &&
                  "border-rose-200 bg-rose-50/40",
              )}
            >
              <div>
                <div className="font-display text-2xl">
                  {blogger.display_name || blogger.full_name || blogger.sl_avatar_name || blogger.email}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                  {blogger.sl_avatar_name || tr("avatar pending")} · UUID {blogger.sl_avatar_uuid ? tr("connected") : tr("missing")} · {blogger.language_preference.toUpperCase()}
                </div>
                {blogger.blogger_tier === "friend" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--brand-magenta)]/25 bg-[var(--brand-pink)]/55 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
                      {tr("Honor guest")}
                    </span>
                    <span className="text-sm text-foreground/55">{tr("No monthly minimum.")}</span>
                  </div>
                ) : null}
                {blogger.account_status === "blocked" ? (
                  <p className="mt-2 text-sm text-rose-700">
                    {tr("Blocked or removed by Love Potion. Review her history before reactivating.")}
                  </p>
                ) : null}
                {blogger.account_status === "left" ? (
                  <p className="mt-2 text-sm text-rose-700">
                    {tr("Left the blogger program. Reactivate only if Love Potion decides to bring her back.")}
                  </p>
                ) : null}
              </div>
              <StatusChip status={blogger.account_status} />
              {blogger.account_status === "active" || blogger.account_status === "pending" || blogger.account_status === "blocked" ? (
                <BloggerProgress blogger={blogger} />
              ) : (
                <div aria-hidden="true" />
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {blogger.account_status === "blocked" || blogger.account_status === "left" ? (
                  <button
                    onClick={() => void reactivateBlogger(blogger)}
                    disabled={statusAction[blogger.id] === "saving"}
                    className="rounded-full bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-background hover:bg-[var(--brand-magenta)] disabled:opacity-60"
                  >
                    {statusAction[blogger.id] === "saving"
                      ? tr("Saving...")
                      : statusAction[blogger.id] === "saved"
                        ? tr("Reactivated")
                        : tr("Reactivate")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedBlogger(blogger);
                  }}
                  aria-label={`${tr("Open")} ${blogger.display_name || blogger.full_name || blogger.sl_avatar_name || "blogger"} ${tr("dossier")}`}
                  className="cursor-pointer rounded-full border border-foreground/25 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-foreground hover:text-background"
                >
                  {tr("Open →")}
                </button>
              </div>
            </GlassCard>
          ))}
          {filtered.length === 0 ? (
            <GlassCard className="p-8">
              <div className="font-hand text-3xl text-[var(--brand-magenta)]">{tr("no bloggers in this filter")}</div>
            </GlassCard>
          ) : null}
        </section>
      ) : null}

      {isCreateOpen ? (
        <CreateBloggerModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            void loadRows();
          }}
        />
      ) : null}

      {selectedBlogger ? (
        <BloggerDossierModal
          blogger={selectedBlogger}
          onClose={() => setSelectedBlogger(null)}
          onUpdated={replaceBlogger}
        />
      ) : null}
    </div>
  );
}

function BloggerDossierModal({
  blogger,
  onClose,
  onUpdated,
}: {
  blogger: BloggerListItem;
  onClose: () => void;
  onUpdated: (blogger: BloggerListItem) => void;
}) {
  const languageCode = useLang();
  const tr = (value: string) => translateAppPhrase(value, languageCode);
  const [dossier, setDossier] = useState<BloggerDossier | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState(blogger.display_name ?? blogger.full_name ?? "");
  const [avatarName, setAvatarName] = useState(blogger.sl_avatar_name ?? "");
  const [avatarUuid, setAvatarUuid] = useState(blogger.sl_avatar_uuid ?? "");
  const [language, setLanguage] = useState<"en" | "es">(blogger.language_preference === "es" ? "es" : "en");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(blogger.account_status);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(blogger.availability_status);
  const [bloggerTier, setBloggerTier] = useState<BloggerTier>(blogger.blogger_tier ?? "standard");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [removeState, setRemoveState] = useState<"idle" | "confirming" | "removing" | "removed" | "error">("idle");

  useEffect(() => {
    setDisplayName(blogger.display_name ?? blogger.full_name ?? "");
    setAvatarName(blogger.sl_avatar_name ?? "");
    setAvatarUuid(blogger.sl_avatar_uuid ?? "");
    setLanguage(blogger.language_preference === "es" ? "es" : "en");
    setAccountStatus(blogger.account_status);
    setAvailabilityStatus(blogger.availability_status);
    setBloggerTier(blogger.blogger_tier ?? "standard");
    setRemoveState("idle");
  }, [blogger]);

  useEffect(() => {
    let cancelled = false;

    async function loadDossier() {
      setState("loading");
      setMessage("");
      try {
        const details = await getBloggerDossier(blogger.id);
        if (!cancelled) {
          setDossier(details);
          setState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Could not load dossier.");
        }
      }
    }

    void loadDossier();
    return () => {
      cancelled = true;
    };
  }, [blogger.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function saveDossier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    setMessage("");

    if (avatarUuid.trim() && !isUuid(avatarUuid.trim())) {
      setSaveState("error");
      setMessage("SL UUID format looks invalid. Use full UUID (8-4-4-4-12).");
      return;
    }

    try {
      const updated = await updateBloggerDetails({
        bloggerId: blogger.id,
        displayName,
        avatarName,
        avatarUuid: avatarUuid.trim() || null,
        language,
        accountStatus,
        availabilityStatus,
        bloggerTier,
      });
      onUpdated(updated);
      setSaveState("saved");
      setMessage("Dossier saved.");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not save dossier.");
    }
  }

  async function removeBlogger() {
    if (removeState === "idle") {
      setRemoveState("confirming");
      setMessage("Click delete again to confirm. This keeps history, but removes her from active lists.");
      return;
    }

    if (removeState !== "confirming") return;

    setRemoveState("removing");
    setMessage("");

    try {
      const updated = await removeBloggerAccount(blogger.id);
      onUpdated(updated);
      setAccountStatus(updated.account_status);
      setRemoveState("removed");
      setMessage("Blogger removed from the active program.");
      window.setTimeout(onClose, 350);
    } catch (error) {
      setRemoveState("error");
      setMessage(error instanceof Error ? error.message : "Could not remove blogger.");
    }
  }

  const submissions = dossier?.submissions ?? [];
  const claims = dossier?.claims ?? [];
  const pendingCount = submissions.filter((submission) => submission.status === "pending").length;
  const deliveredCount = claims.filter((claim) => claim.status === "delivered").length;
  const name = blogger.display_name || blogger.full_name || blogger.sl_avatar_name || blogger.email;

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/50 px-4 py-8 backdrop-blur-sm"
    >
      <form
        onSubmit={saveDossier}
        className="mx-auto max-w-6xl rounded-[2rem] border border-[var(--brand-pink)] bg-background p-6 shadow-2xl md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              {tr("Blogger · dossier")}
            </div>
            <h2 className="mt-2 font-display text-5xl leading-none md:text-6xl">{name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-12 w-12 place-items-center rounded-full bg-foreground text-2xl text-background hover:bg-[var(--brand-magenta)]"
            aria-label={tr("Close blogger dossier")}
          >
            ×
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <GlassCard tone="pink" className="p-5">
            <HandwrittenNote>{tr("look closer")}</HandwrittenNote>
            <div className="mt-5 grid gap-4">
              <Field label={tr("Display name")}>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} />
              </Field>
              <Field label={tr("SL avatar name")}>
                <input value={avatarName} onChange={(event) => setAvatarName(event.target.value)} className={inputClass} />
              </Field>
              <Field label={tr("SL avatar UUID")}>
                <input
                  value={avatarUuid}
                  onChange={(event) => setAvatarUuid(event.target.value)}
                  className={inputClass}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </Field>
              <Field label={tr("Email")}>
                <input value={blogger.email} className={cn(inputClass, "opacity-70")} readOnly />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tr("Account")}>
                  <select
                    value={accountStatus}
                    onChange={(event) => setAccountStatus(event.target.value as AccountStatus)}
                    className={inputClass}
                  >
                    <option value="active">{tr("Active")}</option>
                    <option value="pending">{tr("Pending")}</option>
                    <option value="blocked">{tr("Blocked")}</option>
                    <option value="left">{tr("Left")}</option>
                  </select>
                </Field>
                <Field label={tr("Presence")}>
                  <select
                    value={availabilityStatus}
                    onChange={(event) => setAvailabilityStatus(event.target.value as AvailabilityStatus)}
                    className={inputClass}
                  >
                    <option value="available">{tr("Available")}</option>
                    <option value="vacation">{tr("Vacation")}</option>
                    <option value="busy">{tr("Busy")}</option>
                    <option value="offline">{tr("Offline")}</option>
                  </select>
                </Field>
              </div>
              <Field label={tr("Language")}>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as "en" | "es")}
                  className={inputClass}
                >
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                </select>
              </Field>
              <Field label={tr("Blogging rule")}>
                <select
                  value={bloggerTier}
                  onChange={(event) => setBloggerTier(event.target.value as BloggerTier)}
                  className={inputClass}
                >
                  <option value="standard">{tr("Standard · 1 post/month")}</option>
                  <option value="friend">{tr("Friend · honor guest")}</option>
                </select>
                <p className="mt-2 text-xs text-foreground/55">
                  {tr("Friends are invited guests: they can blog whenever they want and are skipped by the monthly block rule.")}
                </p>
              </Field>
            </div>

            {message ? (
              <div
                className={cn(
                  "mt-5 rounded-2xl border px-4 py-3 text-sm",
                  saveState === "saved"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/50 text-[var(--brand-magenta)]",
                )}
              >
                {tr(message)}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saveState === "saving" || removeState === "removing"}
              className="mt-6 w-full rounded-full bg-foreground px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:opacity-60"
            >
              {saveState === "saving" ? tr("Saving...") : saveState === "saved" ? tr("Saved") : tr("Save dossier")}
            </button>

            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-rose-600">{tr("Danger zone")}</div>
              <p className="mt-2 text-sm text-rose-700/80">
                {tr("Remove this blogger from active lists without deleting her history, posts, claims, or audit trail.")}
              </p>
              <button
                type="button"
                onClick={() => void removeBlogger()}
                disabled={removeState === "removing" || removeState === "removed" || accountStatus === "left"}
                className={cn(
                  "mt-4 w-full rounded-full px-5 py-3 font-mono text-[10px] uppercase tracking-[0.28em] transition disabled:opacity-60",
                  removeState === "confirming"
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "border border-rose-300 text-rose-700 hover:bg-rose-100",
                )}
              >
                {accountStatus === "left" || removeState === "removed"
                  ? accountStatus === "left"
                    ? tr("Left by blogger")
                    : tr("Removed")
                  : removeState === "removing"
                    ? tr("Removing...")
                    : removeState === "confirming"
                      ? tr("Confirm delete")
                      : tr("Delete blogger")}
              </button>
            </div>
          </GlassCard>

          <div className="grid content-start gap-6">
            <div className="grid max-w-3xl items-start gap-4 sm:grid-cols-4">
              <MiniStat label={tr("Claims")} value={claims.length} />
              <MiniStat label={tr("Delivered")} value={deliveredCount} tone="pink" />
              <MiniStat label={tr("Posts")} value={submissions.length} />
              <MiniStat label={tr("Pending")} value={pendingCount} tone={pendingCount > 0 ? "pink" : "plain"} />
            </div>

            {state === "loading" ? (
              <GlassCard className="p-8">
                <div className="font-hand text-3xl text-[var(--brand-magenta)]">{tr("opening dossier...")}</div>
              </GlassCard>
            ) : null}

            {state === "error" ? (
              <GlassCard tone="pink" className="p-8">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                  {tr("Could not load history")}
                </div>
                <p className="mt-3 text-sm text-foreground/75">{message}</p>
              </GlassCard>
            ) : null}

            {state === "ready" ? (
              <div className="grid gap-6 xl:grid-cols-2">
                <HistoryPanel title={tr("Recent claims")} empty={tr("no products claimed yet")}>
                  {claims.map((claim) => (
                    <HistoryRow
                      key={claim.id}
                      imageUrl={claim.product_image_url}
                      title={claim.product_name}
                      meta={`${formatShortDate(claim.claimed_at)} · ${claim.delivered_at ? tr("delivered") : tr("delivery pending")}`}
                      badge={tr(claim.status)}
                    />
                  ))}
                </HistoryPanel>
                <HistoryPanel title={tr("Recent posts")} empty={tr("no posts submitted yet")}>
                  {submissions.map((submission) => (
                    <HistoryRow
                      key={submission.id}
                      imageUrl={submission.product_image_url}
                      title={submission.product_name}
                      meta={`${formatShortDate(submission.submitted_at)} · ${submission.links_count} ${tr("links")}`}
                      badge={tr(submission.status.replace("_", " "))}
                      note={submission.review_comment}
                    />
                  ))}
                </HistoryPanel>
              </div>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}

function MiniStat({ label, value, tone = "plain" }: { label: string; value: number; tone?: "plain" | "pink" }) {
  return (
    <GlassCard
      tone={tone === "pink" ? "pink" : undefined}
      className="aspect-square p-4"
    >
      <div className="font-display text-3xl">{String(value).padStart(2, "0")}</div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-foreground/50">{label}</div>
    </GlassCard>
  );
}

function HistoryPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <GlassCard className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">{title}</div>
      <div className="mt-4 space-y-3">
        {hasChildren ? children : <div className="font-hand text-3xl text-[var(--brand-magenta)]">{empty}</div>}
      </div>
    </GlassCard>
  );
}

function HistoryRow({
  imageUrl,
  title,
  meta,
  badge,
  note,
}: {
  imageUrl: string | null;
  title: string;
  meta: string;
  badge: string;
  note?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/60 p-3">
      <div className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-[var(--brand-pink)]" />
        )}
        <div className="min-w-0">
          <div className="truncate font-display text-xl">{title}</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/45">{meta}</div>
        </div>
        <span className="rounded-full bg-foreground/10 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.22em] text-foreground/60">
          {badge}
        </span>
      </div>
      {note ? <p className="mt-3 rounded-xl bg-[var(--brand-pink)]/45 px-3 py-2 text-sm text-foreground/70">{note}</p> : null}
    </div>
  );
}

function CreateBloggerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const languageCode = useLang();
  const tr = (value: string) => translateAppPhrase(value, languageCode);
  const [displayName, setDisplayName] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [avatarUuid, setAvatarUuid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [accountStatus, setAccountStatus] = useState<"pending" | "active">("active");
  const [bloggerTier, setBloggerTier] = useState<BloggerTier>("standard");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    if (!avatarName.trim()) {
      setState("error");
      setMessage("SL avatar name is required.");
      return;
    }

    if (avatarUuid.trim() && !isUuid(avatarUuid.trim())) {
      setState("error");
      setMessage("SL UUID format looks invalid. Use full UUID (8-4-4-4-12).");
      return;
    }

    try {
      await createBloggerAccount({
        email,
        password,
        displayName,
        avatarName,
        avatarUuid: avatarUuid.trim() || null,
        language,
        accountStatus,
        bloggerTier,
      });
      onCreated();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not create blogger.");
    }
  }

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/50 px-4 py-8 backdrop-blur-sm"
    >
      <form
        onSubmit={createAccount}
        className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--brand-pink)] bg-background p-6 shadow-2xl md:p-8"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          {tr("Blogger · onboarding")}
        </div>
        <h2 className="mt-2 font-display text-5xl leading-none">{tr("Create blogger.")}</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label={tr("Display name")}>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label={tr("Email")}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label={tr("SL avatar name")}>
            <input
              value={avatarName}
              onChange={(event) => setAvatarName(event.target.value)}
              className={inputClass}
              placeholder="Marie Whitfield"
              required
            />
          </Field>
          <Field label={tr("SL avatar UUID")}>
            <input
              value={avatarUuid}
              onChange={(event) => setAvatarUuid(event.target.value)}
              className={inputClass}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </Field>
          <Field label={tr("Temporary password")}>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label={tr("Language")}>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as "en" | "es")}
              className={inputClass}
            >
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
          </Field>
          <Field label={tr("Initial account status")}>
            <select
              value={accountStatus}
              onChange={(event) => setAccountStatus(event.target.value as "pending" | "active")}
              className={inputClass}
            >
              <option value="active">{tr("Active")}</option>
              <option value="pending">{tr("Pending")}</option>
            </select>
          </Field>
          <Field label={tr("Blogging rule")}>
            <select
              value={bloggerTier}
              onChange={(event) => setBloggerTier(event.target.value as BloggerTier)}
              className={inputClass}
            >
              <option value="standard">{tr("Standard · 1 post/month")}</option>
              <option value="friend">{tr("Friend · honor guest")}</option>
            </select>
          </Field>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/50 px-4 py-3 text-sm text-[var(--brand-magenta)]">
            {tr(message)}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-foreground/25 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em]"
          >
            {tr("Cancel")}
          </button>
          <button
            type="submit"
            disabled={state === "saving"}
            className="rounded-full bg-foreground px-6 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:opacity-60"
          >
            {state === "saving" ? tr("Creating...") : tr("Create blogger")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function StatusChip({ status }: { status: string }) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const color =
    status === "active"
      ? "bg-green-500/10 text-green-700"
      : status === "pending"
        ? "bg-orange-500/10 text-orange-700"
        : status === "blocked" || status === "left"
          ? "bg-red-500/10 text-red-700"
          : "bg-foreground/10 text-foreground/70";
  const label =
    status === "left"
      ? tr("program left")
      : status === "blocked"
        ? tr("blocked / removed")
        : tr(status === "pending" ? "Pending" : status === "active" ? "Active" : status);

  return (
    <span
      className={cn(
        "w-fit rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]",
        color,
      )}
    >
      {label}
    </span>
  );
}

function BloggerProgress({ blogger }: { blogger: BloggerListItem }) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const progress = blogger.progress ?? {
    claims: 0,
    delivered: 0,
    posts: 0,
    approved: 0,
    pending: 0,
    needsRevision: 0,
    approvedThisMonth: 0,
  };
  const monthlyTarget = blogger.blogger_tier === "friend" ? 0 : 1;
  const monthProgress = monthlyTarget === 0 ? 100 : Math.min(100, Math.round((progress.approvedThisMonth / monthlyTarget) * 100));
  const isPaused = blogger.account_status === "blocked" || blogger.account_status === "left";
  const statusText = isPaused
    ? tr("paused")
    : blogger.blogger_tier === "friend"
      ? tr("honor guest")
      : progress.approvedThisMonth >= monthlyTarget
        ? tr("month done")
        : tr("monthly post due");

  return (
    <div className="min-w-[220px] rounded-2xl border border-foreground/10 bg-background/55 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-foreground/45">{tr("Progress")}</div>
        <div
          className={cn(
            "rounded-full px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.22em]",
            isPaused
              ? "bg-rose-100 text-rose-700"
              : progress.approvedThisMonth >= monthlyTarget || blogger.blogger_tier === "friend"
                ? "bg-green-500/10 text-green-700"
                : "bg-orange-500/10 text-orange-700",
          )}
        >
          {statusText}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-[var(--brand-magenta)] transition-all"
          style={{ width: `${isPaused ? 0 : monthProgress}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <ProgressMetric label={tr("claims")} value={progress.claims} />
        <ProgressMetric label={tr("sent")} value={progress.delivered} />
        <ProgressMetric label={tr("posts")} value={progress.posts} />
        <ProgressMetric label={tr("ok")} value={progress.approved} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[8px] uppercase tracking-[0.22em] text-foreground/45">
        <span>{progress.approvedThisMonth} {tr("this month")}</span>
        <span>·</span>
        <span>{progress.pending} {tr("pending")}</span>
        {progress.needsRevision > 0 ? (
          <>
            <span>·</span>
            <span>{progress.needsRevision} {tr("revision")}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-foreground/[0.035] px-2 py-2">
      <div className="font-display text-xl leading-none">{value}</div>
      <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.22em] text-foreground/40">{label}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-foreground/15 bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)]";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date pending";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
