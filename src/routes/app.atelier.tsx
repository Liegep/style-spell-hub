import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import bloggerAvatar from "@/assets/blogger-avatar.jpg";
import {
  getAtelierStats,
  getBloggerPulse,
  getDeliveryDeskClaims,
  getReviewQueue,
  getUpcomingArchives,
  reviewSubmission,
  retryDeliveryClaim,
  type AtelierStats,
  type BloggerPulse,
  type DeliveryDeskItem,
  type ReviewQueueItem,
} from "@/integrations/supabase/dashboard";
import { cn } from "@/lib/utils";
import { getCurrentProfile, type AuthProfile } from "@/integrations/supabase/auth";
import { notifySecondLifeQuietly } from "@/integrations/supabase/messages";
import type { ClaimStatus, SubmissionStatus } from "@/integrations/supabase/database.types";
import { useLang } from "@/i18n/dict";
import { translateAppPhrase } from "@/i18n/app-text";

export const Route = createFileRoute("/app/atelier")({
  component: AtelierPage,
});

const emptyAtelierStats: AtelierStats = {
  activeBloggers: 0,
  inactiveBloggers: 0,
  postsThisMonth: 0,
  productsLive: 0,
  archiveSoon: 0,
  subscribers: 0,
};

function AtelierPage() {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const [liveStats, setLiveStats] = useState<AtelierStats>(emptyAtelierStats);
  const [liveBloggers, setLiveBloggers] = useState<BloggerPulse[]>([]);
  const [upcomingArchives, setUpcomingArchives] = useState<{ id: string; name: string; auto_archive_at: string | null }[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewFilter, setReviewFilter] = useState<SubmissionStatus | "all">("pending");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<Record<string, string>>({});
  const [reviewSent, setReviewSent] = useState<Record<string, SubmissionStatus>>({});
  const [reviewError, setReviewError] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [modalReviewWarning, setModalReviewWarning] = useState("");
  const [currentProfile, setCurrentProfile] = useState<AuthProfile | null>(null);
  const [deliveryDesk, setDeliveryDesk] = useState<DeliveryDeskItem[]>([]);
  const [retryingClaimId, setRetryingClaimId] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState("");
  const [dataState, setDataState] = useState<"loading" | "live" | "fallback">("loading");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      const [profile, nextStats, nextBloggers, nextArchives, nextQueue, nextDeliveryDesk] = await Promise.allSettled([
        getCurrentProfile(),
        getAtelierStats(),
        getBloggerPulse(),
        getUpcomingArchives(),
        getReviewQueue(reviewFilter),
        getDeliveryDeskClaims(),
      ]);

      if (!isMounted) return;

      if (profile.status === "fulfilled") setCurrentProfile(profile.value);
      else console.error("[Atelier] Failed to load current profile", profile.reason);

      if (nextStats.status === "fulfilled") setLiveStats(nextStats.value);
      else console.error("[Atelier] Failed to load stats", nextStats.reason);

      if (nextBloggers.status === "fulfilled") setLiveBloggers(nextBloggers.value);
      else console.error("[Atelier] Failed to load blogger pulse", nextBloggers.reason);

      if (nextArchives.status === "fulfilled") setUpcomingArchives(nextArchives.value);
      else console.error("[Atelier] Failed to load archives", nextArchives.reason);

      if (nextQueue.status === "fulfilled") setReviewQueue(nextQueue.value);
      else console.error("[Atelier] Failed to load review queue", nextQueue.reason);

      if (nextDeliveryDesk.status === "fulfilled") setDeliveryDesk(nextDeliveryDesk.value);
      else console.error("[Atelier] Failed to load delivery desk", nextDeliveryDesk.reason);

      setDataState([profile, nextStats, nextBloggers, nextArchives, nextQueue, nextDeliveryDesk].some((result) => result.status === "fulfilled") ? "live" : "fallback");
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [reviewFilter]);

  async function handleRetryDelivery(claimId: string) {
    setDeliveryNotice("");
    setRetryingClaimId(claimId);

    try {
      const result = await retryDeliveryClaim(claimId);
      const refreshed = await getDeliveryDeskClaims();

      setDeliveryDesk(refreshed);
      setDeliveryNotice(result.message ?? "Delivery retried.");
    } catch (error) {
      setDeliveryNotice(error instanceof Error ? error.message : "Could not retry delivery.");
    } finally {
      setRetryingClaimId(null);
    }
  }

  async function handleReview(submissionId: string, status: SubmissionStatus) {
    setReviewError("");
    setReviewingId(submissionId);

    try {
      const profile = await getCurrentProfile();
      if (!profile?.id) throw new Error("Could not identify current reviewer profile.");

      await reviewSubmission({
        submissionId,
        status,
        reviewComment: reviewMessage[submissionId]?.trim() || null,
        reviewedBy: profile.id,
      });

      const reviewedItem = reviewQueue.find((item) => item.id === submissionId);
      const reviewNote = reviewMessage[submissionId]?.trim();
      if (reviewedItem?.blogger_id) {
        const notificationType =
          status === "approved" ? "post_approved" : status === "rejected" ? "post_rejected" : "needs_revision";
        const statusText =
          status === "approved" ? "approved" : status === "rejected" ? "rejected" : "needs revision";

        void notifySecondLifeQuietly(
          {
            recipientId: reviewedItem.blogger_id,
            type: notificationType,
            title: `Post ${statusText}: ${reviewedItem.product_name}`,
            body: reviewNote
              ? `${reviewedItem.product_name}: ${statusText}. Note: ${reviewNote}`
              : `${reviewedItem.product_name}: ${statusText}. Check your Love Potion dashboard.`,
          },
          "Review notification",
        );
      }

      setReviewQueue((current) =>
        current.map((item) =>
          item.id === submissionId
            ? {
                ...item,
                status,
                review_comment: reviewMessage[submissionId]?.trim() || item.review_comment || null,
              }
            : item,
        ),
      );
      setReviewSent((current) => ({ ...current, [submissionId]: status }));
      if (selectedReviewId === submissionId) {
        window.setTimeout(() => setSelectedReviewId(null), 900);
      }
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not review this submission.");
    } finally {
      setReviewingId(null);
    }
  }

  async function handleModalReview(status: SubmissionStatus) {
    if (!selectedReview) return;
    const comment = (reviewMessage[selectedReview.id] ?? selectedReview.review_comment ?? "").trim();

    if (status !== "approved" && !comment) {
      setModalReviewWarning("Leave a short note before sending revision or rejection.");
      return;
    }

    setModalReviewWarning("");
    await handleReview(selectedReview.id, status);
  }

  const metrics = [
    { n: liveStats.activeBloggers, l: tr("Active bloggers"), tone: "pink" as const },
    { n: liveStats.inactiveBloggers, l: tr("Inactive"), tone: "light" as const },
    { n: liveStats.postsThisMonth, l: tr("Posts this month"), tone: "light" as const },
    { n: liveStats.productsLive, l: tr("Products live"), tone: "light" as const },
    { n: liveStats.archiveSoon, l: tr("Archive soon"), tone: "pink" as const },
    { n: liveStats.subscribers, l: tr("Subscribers"), tone: "light" as const },
  ];
  const archiveRows = upcomingArchives;
  const bloggerRows = liveBloggers;
  const selectedReview = selectedReviewId
    ? reviewQueue.find((item) => item.id === selectedReviewId) ?? null
    : null;

  function daysUntil(dateValue: string | null | undefined, fallback?: string) {
    if (!dateValue) return fallback ?? "soon";
    const now = new Date();
    const target = new Date(dateValue);
    const diff = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000));
    return `${diff} days`;
  }

  function bloggerName(blogger: BloggerPulse) {
    return blogger.display_name ?? blogger.full_name ?? blogger.email;
  }

  function bloggerStatus(blogger: BloggerPulse) {
    if (blogger.account_status === "blocked") return "blocked";
    if (blogger.account_status === "left") return "deleted";
    return "";
  }

  function statusTone(status: SubmissionStatus) {
    if (status === "approved") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (status === "needs_revision") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "rejected") return "bg-rose-100 text-rose-700 border-rose-200";
    return "bg-[var(--brand-pink)] text-[var(--brand-magenta)] border-[var(--brand-magenta)]/20";
  }

  function statusLabel(status: SubmissionStatus) {
    if (status === "needs_revision") return "needs revision";
    return status;
  }

  function claimTone(status: ClaimStatus) {
    if (status === "delivered") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (status === "failed") return "bg-rose-100 text-rose-700 border-rose-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  function claimLabel(status: ClaimStatus) {
    if (status === "claimed") return "delivery pending";
    return status;
  }

  function prettyDate(dateValue: string | null | undefined) {
    if (!dateValue) return "not yet";
    return new Date(dateValue).toLocaleDateString();
  }

  const isSuperAdmin = currentProfile?.role === "super_admin";
  const deliveryCounts = deliveryDesk.reduce(
    (acc, claim) => {
      acc[claim.status] += 1;
      return acc;
    },
    { claimed: 0, delivered: 0, failed: 0 } satisfies Record<ClaimStatus, number>,
  );

  useEffect(() => {
    if (!selectedReviewId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedReviewId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedReviewId]);

  useEffect(() => {
    setModalReviewWarning("");
  }, [selectedReviewId]);

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            LOVE POTION OWNER'S ATELIER
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">The atelier.</h1>
        </div>
        <HandwrittenNote>run the house</HandwrittenNote>
      </header>

      <section className="mt-10 grid gap-4 md:grid-cols-6">
        {metrics.map((it) => (
          <GlassCard key={it.l} tone={it.tone} className="p-5">
            <div className="font-display text-4xl">{it.n}</div>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/60">
              {it.l}
            </div>
          </GlassCard>
        ))}
      </section>

      {isSuperAdmin ? (
        <GlassCard className="mt-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                {tr("Delivery desk")}
              </div>
              <HandwrittenNote>keep the magic moving</HandwrittenNote>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                [tr("Delivered"), deliveryCounts.delivered, "text-emerald-700"],
                [tr("Pending"), deliveryCounts.claimed, "text-amber-700"],
                [tr("Failed"), deliveryCounts.failed, "text-rose-700"],
              ].map(([label, count, tone]) => (
                <div key={label} className="rounded-2xl border border-foreground/10 bg-background/70 px-4 py-3 text-center">
                  <div className={cn("font-display text-2xl", tone)}>{count}</div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.24em] text-foreground/45">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {deliveryNotice ? (
            <div
              className={cn(
                "mt-4 rounded-2xl border px-4 py-3 text-sm",
                deliveryNotice.toLowerCase().includes("delivered")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-[var(--brand-magenta)]/25 bg-[var(--brand-pink)]/35 text-[var(--brand-magenta)]",
              )}
            >
              {deliveryNotice}
            </div>
          ) : null}

          {deliveryDesk.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-foreground/10 bg-foreground/[0.03] p-10 text-center">
              <div className="font-hand text-3xl text-[var(--brand-magenta)]">no delivery claims yet</div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
                {tr("Claimed products will appear here.")}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {deliveryDesk.slice(0, 8).map((claim) => (
                <div
                  key={claim.id}
                  className="grid gap-4 rounded-2xl border border-foreground/10 bg-background/70 p-4 md:grid-cols-[auto_1fr_auto]"
                >
                  {claim.product_image ? (
                    <img src={claim.product_image} alt={claim.product_name} className="h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-foreground/10" />
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-display text-2xl">{claim.product_name}</div>
                      <span className={cn("rounded-full border px-3 py-1 font-mono text-[8px] uppercase tracking-[0.22em]", claimTone(claim.status))}>
                        {claimLabel(claim.status)}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/55">
                      {claim.blogger_name} · claimed {prettyDate(claim.claimed_at)} · delivered {prettyDate(claim.delivered_at)}
                    </div>
                    <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.22em] text-foreground/40">
                      SL avatar: {claim.blogger_avatar_name ?? "missing name"} · UUID: {claim.blogger_avatar_uuid ?? "missing uuid"}
                    </div>
                    {claim.delivery_response ? (
                      <div className="mt-2 line-clamp-2 text-xs text-foreground/55">{claim.delivery_response}</div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end">
                    {claim.status === "delivered" ? (
                      <span className="rounded-full bg-emerald-100 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-700">
                        complete
                      </span>
                    ) : (
                      <button
                        onClick={() => void handleRetryDelivery(claim.id)}
                        disabled={retryingClaimId === claim.id || !claim.delivery_item_key}
                        className={cn(
                          "rounded-full px-4 py-3 font-mono text-[9px] uppercase tracking-[0.22em]",
                          retryingClaimId === claim.id || !claim.delivery_item_key
                            ? "bg-foreground/10 text-foreground/35"
                            : "bg-foreground text-background hover:bg-[var(--brand-magenta)]",
                        )}
                      >
                        {retryingClaimId === claim.id ? "retrying..." : claim.delivery_item_key ? "retry delivery" : "missing item key"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      ) : null}

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              Review Queue
            </div>
            <div className="flex gap-2">
              {[
                { label: tr("All"), value: "all" as const },
                { label: tr("Pending"), value: "pending" as const },
                { label: tr("Approved"), value: "approved" as const },
                { label: tr("Needs revision"), value: "needs_revision" as const },
                { label: tr("Rejected"), value: "rejected" as const },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setReviewFilter(filter.value)}
                  className={cn(
                    "rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]",
                    reviewFilter === filter.value
                      ? "bg-foreground text-background"
                      : "bg-foreground/5 text-foreground/55",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          {reviewError ? (
            <div className="mt-4 rounded-xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/40 px-4 py-3 text-sm text-[var(--brand-magenta)]">
              {reviewError}
            </div>
          ) : null}

          {reviewQueue.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-foreground/10 bg-foreground/[0.03] p-14 text-center">
              <div className="font-hand text-3xl text-[var(--brand-magenta)]">
                {tr("No submissions to review")}
              </div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
                {reviewFilter === "pending"
                  ? tr("No pending items. Try all to see reviewed submissions.")
                  : tr("Everything is in order.")}
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {reviewQueue.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedReviewId(item.id)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-background/70 p-4 text-left transition hover:border-[var(--brand-magenta)]/35 hover:bg-background"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-foreground/10" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-display text-2xl">{item.product_name}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/55">
                        {item.blogger_name} · {item.links_count} links · {new Date(item.submitted_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]", statusTone(item.status))}>
                      {item.status.replace("_", " ")}
                    </span>
                    <span className="rounded-full border border-foreground/15 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/55">
                      review
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            Rules in effect
          </div>
          <dl className="mt-8 space-y-6">
            {[
              [tr("Frequency"), tr("1 / month")],
              [tr("Archive"), tr("90 days")],
              [tr("Warn at"), tr("21 days")],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <dt className="font-display text-2xl">{label}</dt>
                <dd className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        <GlassCard tone="pink" className="lg:col-span-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
            Upcoming archive
          </div>
          <ul className="mt-6 space-y-4">
            {archiveRows.length > 0 ? (
              archiveRows.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between border-b border-foreground/10 pb-3"
                >
                  <span>{p.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                    {p.auto_archive_at ? `in ${daysUntil(p.auto_archive_at)}` : "not scheduled"}
                  </span>
                </li>
              ))
            ) : (
              <li className="font-hand text-2xl text-[var(--brand-magenta)]">nothing scheduled</li>
            )}
          </ul>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {tr("Blogger pulse")}
            </div>
            <Link
              to="/app/bloggers"
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]"
            >
              {tr("Open bloggers →")}
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {bloggerRows.map((blogger) => (
              <div key={blogger.id} className="rounded-2xl bg-background/70 p-4">
                <div className="font-display text-xl">{bloggerName(blogger)}</div>
                {bloggerStatus(blogger) ? (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                    {bloggerStatus(blogger)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      {selectedReview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4 py-8 backdrop-blur-sm"
          onMouseDown={() => setSelectedReviewId(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/70 bg-background p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedReviewId(null)}
                className="rounded-full bg-foreground/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-foreground hover:text-background"
              >
                close
              </button>
            </div>

            <div className="mt-2 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-[1.75rem] border border-foreground/10 bg-[var(--brand-pink)]/20 p-4">
                {selectedReview.product_image ? (
                  <img
                    src={selectedReview.product_image}
                    alt={selectedReview.product_name}
                    className="aspect-[4/5] w-full rounded-[1.35rem] object-cover"
                  />
                ) : (
                  <div className="aspect-[4/5] w-full rounded-[1.35rem] bg-foreground/10" />
                )}
                <div className="mt-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                    Review dossier
                  </div>
                  <h2 className="mt-2 font-display text-4xl leading-none">{selectedReview.product_name}</h2>
                  <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/55">
                    {selectedReview.blogger_name} · {selectedReview.links_count} links
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/45">
                    {new Date(selectedReview.submitted_at).toLocaleDateString()}
                  </div>
                  <span
                    className={cn(
                      "mt-4 inline-flex rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]",
                      statusTone(selectedReview.status),
                    )}
                  >
                    {statusLabel(selectedReview.status)}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/55">
                      Links to inspect
                    </div>
                    <HandwrittenNote>review with care</HandwrittenNote>
                  </div>
                  <span className="rounded-full bg-foreground/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/55">
                    {selectedReview.links_count} total
                  </span>
                </div>

                {selectedReview.blogger_note ? (
                  <div className="mt-4 rounded-2xl border border-white/45 bg-[var(--brand-pink)]/45 p-3 shadow-sm backdrop-blur-md">
                    <div className="flex gap-3">
                      <div className="relative h-14 w-14 shrink-0">
                        <img
                          src={getSafeAvatarUrl(selectedReview.blogger_avatar_url)}
                          alt=""
                          className="h-14 w-14 rounded-2xl object-cover shadow-sm"
                        />
                        <span className="absolute -right-2 -top-2 max-w-[8rem] truncate rounded-full bg-[var(--brand-rose)] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.18em] text-white shadow-md">
                          {formatCommentStatus(
                            selectedReview.blogger_status_message,
                            selectedReview.blogger_availability_status,
                          )}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--brand-magenta)]">
                          Blogger note · {selectedReview.blogger_name}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-foreground/75">
                          {selectedReview.blogger_note}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3">
                  {selectedReview.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-foreground/10 bg-background px-4 py-3 text-sm hover:border-[var(--brand-magenta)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <span>
                          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/55">
                            {link.platform}
                          </span>
                          <span className="mt-1 block break-all">{link.url}</span>
                          {link.note ? (
                            <span className="mt-2 block text-xs italic text-foreground/55">{link.note}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 rounded-full bg-foreground/10 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.22em] text-foreground/55">
                          open →
                        </span>
                      </div>
                    </a>
                  ))}
                </div>

                <label className="mt-5 block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/55">
                    Feedback for blogger
                  </span>
                  <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/35">
                    visible in her posts
                  </span>
                  <textarea
                    value={reviewMessage[selectedReview.id] ?? selectedReview.review_comment ?? ""}
                    onChange={(event) =>
                      setReviewMessage((current) => ({ ...current, [selectedReview.id]: event.target.value }))
                    }
                    rows={4}
                    placeholder="Write what the blogger should see..."
                    className="mt-2 w-full rounded-2xl border border-foreground/15 bg-background px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)]"
                  />
                </label>
                {modalReviewWarning ? (
                  <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {modalReviewWarning}
                  </p>
                ) : (
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/45">
                    Tip: revision and rejection are kinder with a short reason.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  {reviewingId === selectedReview.id ? (
                    <span className="rounded-full bg-foreground/10 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/70">
                      sending...
                    </span>
                  ) : reviewSent[selectedReview.id] ? (
                    <span className="rounded-full bg-emerald-100 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-700">
                      sent to blogger
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => void handleModalReview("approved")}
                        className="rounded-full bg-green-600 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white"
                    >
                        Approve
                      </button>
                      <button
                        onClick={() => void handleModalReview("needs_revision")}
                        className="rounded-full bg-amber-500 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white"
                    >
                        Needs revision
                      </button>
                      <button
                        onClick={() => void handleModalReview("rejected")}
                        className="rounded-full bg-rose-600 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white"
                    >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getSafeAvatarUrl(value?: string | null) {
  if (!value || value.startsWith("blob:")) return bloggerAvatar;
  return value;
}

function formatCommentStatus(value?: string | null, availability?: string | null) {
  const note = value?.trim();
  if (note) return note;
  if (availability === "available") return "Available";
  if (availability === "vacation") return "On vacation";
  if (availability === "busy") return "Busy";
  if (availability === "offline") return "Offline";
  return "Blogger";
}
