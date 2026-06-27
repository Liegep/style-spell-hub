import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { products, stats } from "@/mocks/data";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/integrations/supabase/auth";
import { getReviewQueue, reviewSubmission, type ReviewQueueItem } from "@/integrations/supabase/dashboard";
import {
  listPersonalInboxMessages,
  markInternalMessageRead,
  listMessageRecipients,
  listRecentSentMessages,
  notifySecondLifeQuietly,
  sendInternalReply,
  sendInternalMessage,
  sendSecondLifeNotification,
  type InboxMessage,
  type MessageRecipient,
  type SentMessage,
} from "@/integrations/supabase/messages";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/integrations/supabase/notifications";
import {
  addNewsletterSubscriber,
  importNewsletterSubscribersFromCsv,
  listNewsletterCampaignsWithStats,
  listNewsletterSubscribers,
  sendNewsletterCampaign,
  setNewsletterSubscriberActive,
  type NewsletterCampaignWithStats,
} from "@/integrations/supabase/newsletter";
import type {
  MessageScope,
  NewsletterSubscriber,
  SubmissionStatus,
} from "@/integrations/supabase/database.types";

type Tab =
  | "overview" | "products" | "inbox" | "newsletter"
  | "locations" | "preferences" | "notifications" | "subscribers";

export const Route = createFileRoute("/app/admin")({
  validateSearch: (s: Record<string, unknown>): { section?: Tab } => ({
    section: (s.section as Tab) || undefined,
  }),
  component: AdminDash,
});

const TITLES: Partial<Record<Tab, { eyebrow: string; title: string; note: string }>> = {
  overview:      { eyebrow: "ADMIN · Nº 02",         title: "The atelier.",        note: "run the house" },
  locations:     { eyebrow: "LOVE POTION · MAP",       title: "On the grid.",        note: "where they pose" },
  products:      { eyebrow: "LOVE POTION · STOCK",     title: "The drops.",          note: "fresh on shelves" },
  preferences:   { eyebrow: "LOVE POTION · RULES",     title: "House rules.",        note: "set the tempo" },
  notifications: { eyebrow: "LOVE POTION · INBOX",     title: "Whispers.",           note: "stay in touch" },
  inbox:         { eyebrow: "ADMIN · COMPOSE",        title: "Write a love note.",  note: "from you, to them" },
  subscribers:   { eyebrow: "LOVE POTION SUBSCRIBERS · LIST", title: "The list.",           note: "people who care" },
  newsletter:    { eyebrow: "LOVE POTION SUBSCRIBERS · SEND", title: "A new edition.",      note: "send to grid" },
};

function AdminDash() {
  const navigate = useNavigate({ from: "/app/admin" });
  const location = useLocation();
  const { section } = Route.useSearch();
  const uiLang = (location.search as { uiLang?: string } | undefined)?.uiLang;
  const tab: Tab = section ?? "overview";
  const setTab = (v: Tab) =>
    navigate({ search: { uiLang, section: v === "overview" ? undefined : v } });
  const meta = TITLES[tab] ?? TITLES.overview!;
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewFilter, setReviewFilter] = useState<SubmissionStatus | "all">("pending");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<Record<string, string>>({});
  const [reviewSent, setReviewSent] = useState<Record<string, SubmissionStatus>>({});
  const [reviewError, setReviewError] = useState("");
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [newsletterView, setNewsletterView] = useState<"compose" | "sent" | "subscribers">("compose");
  const adminTabs: Array<{ id: Tab; label: string; sub: string }> = [];
  if (tab === "overview") {
    adminTabs.push({ id: "overview", label: "Overview", sub: "01" });
  }
  if (tab === "products") {
    adminTabs.push({ id: "products", label: "Products", sub: "02" });
  }
  if (tab === "inbox") {
    adminTabs.push({ id: "inbox", label: mailUnreadCount ? `Compose (${mailUnreadCount})` : "Compose", sub: "03" });
  }
  if (tab === "newsletter") {
    adminTabs.push({ id: "newsletter", label: "Newsletter", sub: "04" });
  }

  useEffect(() => {
    let mounted = true;

    async function loadReviewQueue() {
      try {
        const queue = await getReviewQueue(reviewFilter);
        if (!mounted) return;
        setReviewQueue(queue);
      } catch (error) {
        if (!mounted) return;
        setReviewError(error instanceof Error ? error.message : "Could not load review queue.");
      }
    }

    void loadReviewQueue();
    return () => {
      mounted = false;
    };
  }, [reviewFilter]);

  useEffect(() => {
    let mounted = true;

    async function loadMailUnreadCount() {
      try {
        const profile = await getCurrentProfile();
        if (!profile?.id) return;
        const messages = await listPersonalInboxMessages(profile.id);
        if (!mounted) return;
        setMailUnreadCount(messages.filter((message) => !message.read_at).length);
      } catch (error) {
        console.error("[Admin] failed to load mail unread count", error);
      }
    }

    void loadMailUnreadCount();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleReview(submissionId: string, status: SubmissionStatus) {
    setReviewError("");
    setReviewingId(submissionId);

    try {
      const profile = await getCurrentProfile();
      if (!profile?.id) throw new Error("Reviewer profile not found.");

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
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not review this submission.");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="px-6 py-10 md:px-12">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {meta.eyebrow}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">
            {meta.title}
          </h1>
        </div>
        <HandwrittenNote>{meta.note}</HandwrittenNote>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={adminTabs}
        />
        {tab === "newsletter" ? (
          <NewsletterViewTabs newsletterView={newsletterView} setNewsletterView={setNewsletterView} uiLang={uiLang} />
        ) : null}
      </div>

      <div className="mt-10">
        {tab === "overview" && (
          <Overview
            reviewQueue={reviewQueue}
            reviewFilter={reviewFilter}
            setReviewFilter={setReviewFilter}
            reviewMessage={reviewMessage}
            reviewSent={reviewSent}
            setReviewMessage={setReviewMessage}
            reviewingId={reviewingId}
            reviewError={reviewError}
            onReview={handleReview}
          />
        )}
        {tab === "products" && <Products />}
        {tab === "inbox" && <Compose onUnreadChange={setMailUnreadCount} />}
        {tab === "newsletter" && (
          <Newsletter newsletterView={newsletterView} setNewsletterView={setNewsletterView} />
        )}
        {tab === "locations" && <Locations />}
        {tab === "preferences" && <Preferences />}
        {tab === "notifications" && <Notifications />}
        {tab === "subscribers" && <Subscribers />}
      </div>
    </div>
  );
}

function Overview({
  reviewQueue,
  reviewFilter,
  setReviewFilter,
  reviewMessage,
  reviewSent,
  setReviewMessage,
  reviewingId,
  reviewError,
  onReview,
}: {
  reviewQueue: ReviewQueueItem[];
  reviewFilter: SubmissionStatus | "all";
  setReviewFilter: (value: SubmissionStatus | "all") => void;
  reviewMessage: Record<string, string>;
  reviewSent: Record<string, SubmissionStatus>;
  setReviewMessage: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reviewingId: string | null;
  reviewError: string;
  onReview: (submissionId: string, status: SubmissionStatus) => Promise<void>;
}) {
  const items = [
    { n: stats.activeBloggers,   l: "Active bloggers" },
    { n: stats.inactiveBloggers, l: "Inactive" },
    { n: stats.postsThisMonth,   l: "Posts this month" },
    { n: stats.productsLive,     l: "Products live" },
    { n: stats.archiveSoon,      l: "Archive soon" },
    { n: stats.subscribers,      l: "Subscribers" },
  ];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-6">
        {items.map((it, i) => (
          <GlassCard key={it.l} tone={i === 0 || i === 4 ? "pink" : "light"} className="p-5">
            <div className="font-display text-3xl">{it.n}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/60">{it.l}</div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-10">
        <GlassCard className="md:col-span-3">
          <div className="flex items-center justify-between gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              REVIEW QUEUE
            </div>
            <div className="flex gap-2">
              {[
                { label: "All", value: "all" as const },
                { label: "Pending", value: "pending" as const },
                { label: "Approved", value: "approved" as const },
                { label: "Needs revision", value: "needs_revision" as const },
                { label: "Rejected", value: "rejected" as const },
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
            <div className="mt-4 rounded-xl border border-dashed border-foreground/15 p-6 text-center font-hand text-2xl text-[var(--brand-magenta)]">
              {reviewFilter === "pending" ? "no pending submissions · try ALL" : "no submissions to review"}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {reviewQueue.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border p-3",
                    index === 0
                      ? "border-foreground/15 bg-background/80"
                      : "border-foreground/10 bg-background/60 opacity-70 grayscale-[0.2]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-foreground/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-xl">{item.product_name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/55">
                        {item.blogger_name} · {item.links_count} links
                      </div>
                    </div>
                    <span className="rounded-full bg-foreground/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.22em]">
                      {item.status.replace("_", " ")}
                    </span>
                  </div>

                  <textarea
                    value={reviewMessage[item.id] ?? item.review_comment ?? ""}
                    onChange={(event) =>
                      setReviewMessage((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                    rows={2}
                    placeholder="Comment for blogger"
                    className="mt-3 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-[var(--brand-magenta)]"
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {reviewingId === item.id ? (
                      <span className="rounded-full bg-foreground/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/70">
                        sending...
                      </span>
                    ) : reviewSent[item.id] ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-700">
                        sent to blogger
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => void onReview(item.id, "approved")}
                          className="rounded-full bg-green-600 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => void onReview(item.id, "needs_revision")}
                          className="rounded-full bg-amber-500 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white"
                        >
                          Needs revision
                        </button>
                        <button
                          onClick={() => void onReview(item.id, "rejected")}
                          className="rounded-full bg-rose-600 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <GlassCard className="md:col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">RULES IN EFFECT</div>
          <ul className="mt-4 space-y-3">
            {[
              { k: "Post frequency", v: "1 post / month" },
              { k: "Auto-archive", v: "After 90 days available" },
              { k: "Inactivity warning", v: "21 days no posts" },
            ].map((r) => (
              <li key={r.k} className="flex items-center justify-between rounded-xl bg-background/60 px-4 py-3">
                <span className="font-display text-lg">{r.k}</span>
                <span className="rounded-full bg-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-background">{r.v}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard tone="pink">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">UPCOMING ARCHIVE</div>
          <ul className="mt-4 space-y-2 text-sm">
            {products.filter(p => p.expires.includes("days") && parseInt(p.expires) < 30).map(p => (
              <li key={p.id} className="flex items-center justify-between border-b border-foreground/10 pb-2">
                <span>{p.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">in {p.expires}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

      </div>
    </div>
  );
}

function Products() {
  return (
    <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const days = parseInt(p.expires);
        const danger = !isNaN(days) && days < 30;
        return (
          <GlassCard key={p.id} className="overflow-hidden p-0">
            <img src={p.img} alt={p.name} loading="lazy" className="aspect-[4/5] w-full object-cover" />
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                Added {p.added}
              </div>
              <h3 className="mt-1 font-display text-2xl">{p.name}</h3>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm">{p.claims} claims</span>
                <span className={cn(
                  "rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.25em]",
                  danger ? "bg-[var(--brand-magenta)] text-white" : "bg-foreground/10",
                )}>
                  {p.expires}
                </span>
              </div>
              {/* Timeline bar */}
              <div className="mt-3 h-1 w-full rounded-full bg-foreground/10">
                <div
                  className={cn("h-1 rounded-full", danger ? "bg-[var(--brand-magenta)]" : "bg-[var(--brand-rose)]")}
                  style={{ width: `${Math.min(100, ((90 - (parseInt(p.added) || 0)) / 90) * 100)}%` }}
                />
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

function FormBuilder() {
  const fieldTypes = ["Short text", "Long text", "Email", "URL", "Select", "Checkbox", "File", "Date"];
  const canvasFields = [
    { t: "Short text", k: "SL avatar name" },
    { t: "Email", k: "Contact email" },
    { t: "URL", k: "Flickr URL" },
    { t: "Long text", k: "Why Love Potion?" },
    { t: "Select", k: "Hours per week" },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-12">
      <GlassCard className="md:col-span-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">FIELDS</div>
        <div className="mt-4 flex flex-col gap-2">
          {fieldTypes.map((f) => (
            <button key={f} className="flex items-center justify-between rounded-lg border border-dashed border-foreground/30 px-3 py-2 text-left text-sm hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]">
              <span>{f}</span>
              <span className="font-mono text-[10px]">+</span>
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard tone="pink" className="md:col-span-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">CANVAS</div>
            <h3 className="mt-1 font-display text-2xl">Blogger application</h3>
          </div>
          <button className="rounded-full bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background">Publish</button>
        </div>
        <div className="mt-6 space-y-3">
          {canvasFields.map((f, i) => (
            <div key={f.k} className="group flex items-center justify-between rounded-xl bg-background/70 p-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">Nº 0{i + 1} · {f.t}</div>
                <div className="mt-1 font-display text-lg">{f.k}</div>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">⋮⋮ drag</div>
            </div>
          ))}
          <div className="rounded-xl border-2 border-dashed border-foreground/20 p-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
            drop a field here
          </div>
        </div>
      </GlassCard>

      <GlassCard className="md:col-span-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">PROPERTIES</div>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">Label</span>
            <input className="mt-1 w-full rounded-lg border border-foreground/20 bg-background/70 px-3 py-2" defaultValue="Flickr URL" />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">Required</span>
            <select className="mt-1 w-full rounded-lg border border-foreground/20 bg-background/70 px-3 py-2">
              <option>Yes</option>
              <option>No</option>
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">Validation</span>
            <input className="mt-1 w-full rounded-lg border border-foreground/20 bg-background/70 px-3 py-2" defaultValue="URL" />
          </label>
        </div>
      </GlassCard>
    </div>
  );
}

function Compose({ onUnreadChange }: { onUnreadChange: (count: number) => void }) {
  const [scope, setScope] = useState<MessageScope>("personal");
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recent, setRecent] = useState<SentMessage[]>([]);
  const [received, setReceived] = useState<InboxMessage[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [showAllReceived, setShowAllReceived] = useState(false);
  const [openThreadKey, setOpenThreadKey] = useState<string | null>(null);
  const [threadReplyBody, setThreadReplyBody] = useState<Record<string, string>>({});
  const [threadSendingKey, setThreadSendingKey] = useState<string | null>(null);
  const [threadFeedback, setThreadFeedback] = useState<Record<string, string>>({});
  const [slState, setSlState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [slFeedback, setSlFeedback] = useState("");

  const visibleReceived = showAllReceived ? received : received.slice(0, 5);
  const conversations = useMemo(() => {
    const threadMap = new Map<
      string,
      {
        key: string;
        name: string;
        latestAt: string;
        messages: Array<{
          id: string;
          direction: "in" | "out";
          subject: string;
          body: string | null;
          created_at: string;
          unread?: boolean;
        }>;
      }
    >();

    received.forEach((message) => {
      if (!message.sender_id) return;
      const key = message.sender_id;
      const thread = threadMap.get(key) ?? {
        key,
        name: message.sender_name || "blogger",
        latestAt: message.created_at,
        messages: [],
      };
      thread.latestAt = thread.latestAt > message.created_at ? thread.latestAt : message.created_at;
      thread.messages.push({
        id: message.id,
        direction: "in",
        subject: message.subject,
        body: message.body,
        created_at: message.created_at,
        unread: !message.read_at,
      });
      threadMap.set(key, thread);
    });

    recent.forEach((message) => {
      if (message.scope !== "personal" || !message.recipient_id) return;
      const key = message.recipient_id;
      const thread = threadMap.get(key) ?? {
        key,
        name: message.recipient_name || "blogger",
        latestAt: message.created_at,
        messages: [],
      };
      thread.latestAt = thread.latestAt > message.created_at ? thread.latestAt : message.created_at;
      thread.messages.push({
        id: message.id,
        direction: "out",
        subject: message.subject,
        body: message.body,
        created_at: message.created_at,
      });
      threadMap.set(key, thread);
    });

    return [...threadMap.values()]
      .map((thread) => ({
        ...thread,
        messages: thread.messages.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
      }))
      .sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));
  }, [received, recent]);

  useEffect(() => {
    let mounted = true;

    async function loadComposeData() {
      try {
        const profile = await getCurrentProfile();
        const [recipientRows, sentRows, receivedRows] = await Promise.all([
          listMessageRecipients(),
          profile?.id ? listRecentSentMessages(profile.id) : Promise.resolve([]),
          profile?.id ? listPersonalInboxMessages(profile.id) : Promise.resolve([]),
        ]);
        if (!mounted) return;
        setRecipients(recipientRows);
        setRecent(sentRows);
        setReceived(receivedRows);
        onUnreadChange(receivedRows.filter((message) => !message.read_at).length);
        setRecipientId(recipientRows[0]?.id ?? "");
      } catch (error) {
        console.error("[Compose] failed to load", error);
        if (!mounted) return;
        setError(error instanceof Error ? error.message : "Could not load mailbox tools.");
      }
    }

    void loadComposeData();
    return () => {
      mounted = false;
    };
  }, [onUnreadChange]);

  async function onMarkRead(messageId: string) {
    setMarkingReadId(messageId);
    try {
      await markInternalMessageRead(messageId);
      setReceived((current) => {
        const next = current.map((message) =>
          message.id === messageId ? { ...message, read_at: message.read_at ?? new Date().toISOString() } : message,
        );
        onUnreadChange(next.filter((message) => !message.read_at).length);
        return next;
      });
    } catch (error) {
      console.error("[Compose] failed to mark message read", error);
      setError(error instanceof Error ? error.message : "Could not mark message as read.");
    } finally {
      setMarkingReadId(null);
    }
  }

  async function onSend() {
    setError("");
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (scope === "personal" && !recipientId) {
      setError("Choose a blogger recipient.");
      return;
    }

    setState("sending");
    try {
      const profile = await getCurrentProfile();
      if (!profile?.id) throw new Error("Sender profile not found.");
      const sent = await sendInternalMessage({
        senderId: profile.id,
        scope,
        recipientId: scope === "personal" ? recipientId : null,
        subject,
        body,
      });

      if (scope === "personal" && recipientId) {
        void notifySecondLifeQuietly(
          {
            recipientId,
            type: "new_message",
            title: subject.trim(),
            body: body.trim() || "You have a new message from Love Potion HQ.",
          },
          "Personal message notification",
        );
      } else if (scope === "broadcast") {
        recipients.forEach((recipient) => {
          void notifySecondLifeQuietly(
            {
              recipientId: recipient.id,
              type: "new_message",
              title: subject.trim(),
              body: body.trim() || "Love Potion HQ sent a new announcement.",
            },
            "Broadcast message notification",
          );
        });
      }

      const recipientName =
        scope === "broadcast"
          ? null
          : recipients.find((recipient) => recipient.id === recipientId)?.display_name ||
            recipients.find((recipient) => recipient.id === recipientId)?.full_name ||
            recipients.find((recipient) => recipient.id === recipientId)?.email ||
            null;

      setRecent((current) => [{ ...sent, recipient_name: recipientName }, ...current].slice(0, 8));
      setSubject("");
      setBody("");
      setState("sent");
      window.setTimeout(() => setState("idle"), 2500);
    } catch (error) {
      console.error("[Compose] failed to send", error);
      setError(error instanceof Error ? error.message : "Could not send message.");
      setState("error");
    }
  }

  async function onSendSecondLifeTest() {
    setError("");
    setSlFeedback("");

    if (scope !== "personal" || !recipientId) {
      setSlFeedback("Choose one blogger first.");
      setSlState("error");
      return;
    }

    const recipient = recipients.find((item) => item.id === recipientId);
    const recipientName = recipient?.display_name || recipient?.full_name || recipient?.sl_avatar_name || "there";
    const testTitle = subject.trim() || "Love Potion HQ";
    const testBody = body.trim() || `Hi ${recipientName}, this is a Second Life IM test from Love Potion HQ.`;

    setSlState("sending");
    try {
      await sendSecondLifeNotification({
        recipientId,
        title: testTitle,
        body: testBody,
        type: "manual",
      });
      setSlFeedback("Second Life IM sent.");
      setSlState("sent");
      window.setTimeout(() => {
        setSlState("idle");
        setSlFeedback("");
      }, 3500);
    } catch (error) {
      console.error("[Compose] failed to send Second Life notification", error);
      setSlFeedback(error instanceof Error ? error.message : "Could not send the Second Life IM.");
      setSlState("error");
    }
  }

  async function onThreadReply(thread: (typeof conversations)[number]) {
    const replyBody = threadReplyBody[thread.key]?.trim();
    setThreadFeedback((current) => ({ ...current, [thread.key]: "" }));

    if (!replyBody) {
      setThreadFeedback((current) => ({ ...current, [thread.key]: "Write a reply first." }));
      return;
    }

    const latestSubject = thread.messages[0]?.subject || "Message";
    const subjectLine = latestSubject.toLowerCase().startsWith("re:") ? latestSubject : `Re: ${latestSubject}`;

    setThreadSendingKey(thread.key);
    try {
      const profile = await getCurrentProfile();
      if (!profile?.id) throw new Error("Sender profile not found.");

      const sent = await sendInternalReply({
        senderId: profile.id,
        recipientId: thread.key,
        subject: subjectLine,
        body: replyBody,
      });

      void notifySecondLifeQuietly(
        {
          recipientId: thread.key,
          type: "new_message",
          title: subjectLine,
          body: replyBody,
        },
        "Thread reply notification",
      );

      setRecent((current) => [{ ...sent, recipient_name: thread.name }, ...current].slice(0, 30));
      setThreadReplyBody((current) => ({ ...current, [thread.key]: "" }));
      setThreadFeedback((current) => ({ ...current, [thread.key]: "Reply sent." }));
    } catch (error) {
      console.error("[Compose] failed to reply in thread", error);
      setThreadFeedback((current) => ({
        ...current,
        [thread.key]: error instanceof Error ? error.message : "Could not send this reply.",
      }));
    } finally {
      setThreadSendingKey(null);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
      <GlassCard tone="pink" className="p-6">
        <div className="flex items-center gap-2">
          {(["personal", "broadcast"] as MessageScope[]).map((item) => (
            <button
              key={item}
              onClick={() => setScope(item)}
              className={cn(
                "rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em]",
                scope === item
                  ? "bg-foreground text-background"
                  : "border border-foreground/30 hover:border-[var(--brand-magenta)]",
              )}
            >
              {item === "personal" ? "Personal" : "Broadcast (all)"}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {scope === "personal" ? (
            <select
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
              className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm"
            >
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.display_name || recipient.full_name || recipient.email}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-full border border-foreground/20 bg-background/50 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/60">
              Sending to all bloggers
            </div>
          )}
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
            className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            placeholder="Write something with style..."
            className="w-full rounded-2xl border border-foreground/30 bg-background/70 px-5 py-3 text-sm"
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            {(error || state === "sent") ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  state === "sent" ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700",
                )}
              >
                {state === "sent" ? "Message sent." : error}
              </span>
            ) : null}
            {scope === "personal" ? (
              <>
                {slFeedback ? (
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      slState === "sent" ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700",
                    )}
                  >
                    {slFeedback}
                  </span>
                ) : null}
                <button
                  onClick={() => void onSendSecondLifeTest()}
                  disabled={slState === "sending" || !recipientId}
                  className="rounded-full border border-[var(--brand-magenta)]/40 bg-background/70 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)] hover:bg-[var(--brand-magenta)] hover:text-white disabled:opacity-50"
                >
                  {slState === "sending" ? "Sending SL..." : "Test SL IM"}
                </button>
              </>
            ) : null}
            <button
              onClick={() => void onSend()}
              disabled={state === "sending"}
              className="rounded-full bg-foreground px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:opacity-60"
            >
              {state === "sending" ? "Sending..." : "Send →"}
            </button>
          </div>
        </div>
      </GlassCard>
      <GlassCard>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
          RECEIVED · RECENT
        </div>
        <ul className="mt-4 space-y-3">
          {visibleReceived.map((message) => {
            const unread = !message.read_at;
            return (
            <li
              key={message.id}
              className={cn(
                "rounded-2xl border p-3 transition-colors",
                unread
                  ? "border-[var(--brand-magenta)]/25 bg-[var(--brand-pink)]/70 shadow-[0_18px_45px_rgba(219,24,97,0.10)]"
                  : "border-foreground/10 bg-background/60",
              )}
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/50">
                {message.sender_name || "blogger"} · {new Date(message.created_at).toLocaleDateString()}
                {unread ? " · NEW" : ""}
              </div>
              <div className="mt-1 font-display text-base">{message.subject}</div>
              {message.body ? (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/65">{message.body}</p>
              ) : null}
              {unread ? (
                <button
                  onClick={() => void onMarkRead(message.id)}
                  disabled={markingReadId === message.id}
                  className="mt-3 rounded-full bg-foreground px-3 py-1 font-mono text-[9px] uppercase tracking-[0.24em] text-background disabled:opacity-60"
                >
                  {markingReadId === message.id ? "marking..." : "mark read"}
                </button>
              ) : null}
            </li>
            );
          })}
          {received.length === 0 ? (
            <li className="font-hand text-2xl text-[var(--brand-magenta)]">no replies yet</li>
          ) : null}
        </ul>
        {received.length > 5 ? (
          <button
            onClick={() => setShowAllReceived((current) => !current)}
            className="mt-3 rounded-full border border-foreground/20 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/60 hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]"
          >
            {showAllReceived ? "show less" : `view all (${received.length})`}
          </button>
        ) : null}
        <div className="mt-6 border-t border-foreground/10 pt-5 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
          CONVERSATION HISTORY
        </div>
        <ul className="mt-4 space-y-3">
          {conversations.slice(0, 5).map((thread) => {
            const open = openThreadKey === thread.key;
            const unreadCount = thread.messages.filter((message) => message.unread).length;
            return (
              <li key={thread.key} className="rounded-2xl border border-foreground/10 bg-background/50 p-3">
                <button
                  onClick={() => setOpenThreadKey((current) => (current === thread.key ? null : thread.key))}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <span>
                    <span className="block font-display text-base">{thread.name}</span>
                    <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/50">
                      {thread.messages.length} messages · {new Date(thread.latestAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-[0.2em]",
                      unreadCount ? "bg-[var(--brand-magenta)] text-white" : "bg-foreground/10 text-foreground/55",
                    )}
                  >
                    {unreadCount ? `${unreadCount} new` : open ? "close" : "open"}
                  </span>
                </button>
                {open ? (
                  <div className="mt-3 space-y-2">
                    {thread.messages.slice(0, 6).map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "rounded-xl px-3 py-2 text-xs",
                          message.direction === "in"
                            ? "bg-[var(--brand-pink)]/55"
                            : "bg-foreground/5 text-foreground/70",
                        )}
                      >
                        <div className="font-mono text-[8px] uppercase tracking-[0.24em] text-foreground/45">
                          {message.direction === "in" ? "blogger" : "you"} ·{" "}
                          {new Date(message.created_at).toLocaleDateString()}
                        </div>
                        <div className="mt-1 font-display text-sm">{message.subject}</div>
                        {message.body ? (
                          <p className="mt-1 line-clamp-3 text-foreground/65">{message.body}</p>
                        ) : null}
                      </div>
                    ))}
                    <div className="rounded-xl border border-[var(--brand-magenta)]/15 bg-background/60 p-3">
                      <label className="block">
                        <span className="font-mono text-[8px] uppercase tracking-[0.24em] text-foreground/45">
                          quick reply
                        </span>
                        <textarea
                          value={threadReplyBody[thread.key] ?? ""}
                          onChange={(event) =>
                            setThreadReplyBody((current) => ({ ...current, [thread.key]: event.target.value }))
                          }
                          rows={3}
                          placeholder={`Reply to ${thread.name}...`}
                          className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-xs outline-none focus:border-[var(--brand-magenta)]"
                        />
                      </label>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            "text-xs",
                            threadFeedback[thread.key] === "Reply sent."
                              ? "text-emerald-700"
                              : "text-[var(--brand-magenta)]",
                          )}
                        >
                          {threadFeedback[thread.key]}
                        </span>
                        <button
                          onClick={() => void onThreadReply(thread)}
                          disabled={threadSendingKey === thread.key}
                          className="rounded-full bg-[var(--brand-magenta)] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.24em] text-white disabled:opacity-60"
                        >
                          {threadSendingKey === thread.key ? "sending..." : "reply"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
          {conversations.length === 0 ? (
            <li className="font-hand text-2xl text-[var(--brand-magenta)]">no conversations yet</li>
          ) : null}
        </ul>
      </GlassCard>
    </div>
  );
}

function NewsletterViewTabs({
  newsletterView,
  setNewsletterView,
  uiLang,
}: {
  newsletterView: "compose" | "sent" | "subscribers";
  setNewsletterView: (view: "compose" | "sent" | "subscribers") => void;
  uiLang?: string;
}) {
  const isSpanish = uiLang === "es";
  const labels = [
    ["compose", isSpanish ? "Redactar" : "Compose"],
    ["sent", isSpanish ? "Enviados" : "Sent editions"],
    ["subscribers", isSpanish ? "Suscriptores" : "Subscribers"],
  ];

  return (
    <div className="flex w-fit rounded-full border border-foreground/10 bg-white/45 p-1">
      {labels.map(([view, label]) => (
        <button
          key={view}
          type="button"
          onClick={() => setNewsletterView(view as "compose" | "sent" | "subscribers")}
          data-i18n-skip
          className={cn(
            "rounded-full px-5 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition",
            newsletterView === view
              ? "bg-foreground text-background"
              : "text-foreground/55 hover:text-[var(--brand-magenta)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Newsletter({
  newsletterView,
  setNewsletterView,
}: {
  newsletterView: "compose" | "sent" | "subscribers";
  setNewsletterView: (view: "compose" | "sent" | "subscribers") => void;
}) {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [campaigns, setCampaigns] = useState<NewsletterCampaignWithStats[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [slTextureItemName, setSlTextureItemName] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "sending" | "importing" | "error">("loading");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const activeSubscribers = subscribers.filter((subscriber) => subscriber.is_active && !subscriber.unsubscribed_at);

  async function loadNewsletter() {
    try {
      const [subscriberRows, campaignRows] = await Promise.all([
        listNewsletterSubscribers(),
        listNewsletterCampaignsWithStats(),
      ]);
      setSubscribers(subscriberRows);
      setCampaigns(campaignRows);
      setState("ready");
      setError("");
    } catch (loadError) {
      console.error("[Newsletter] failed to load data", loadError);
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Could not load newsletter.");
    }
  }

  useEffect(() => {
    void loadNewsletter();
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
  }

  async function onCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setState("importing");
    setFeedback("");
    setError("");

    try {
      const count = await importNewsletterSubscribersFromCsv(file);
      setFeedback(`${count} subscriber${count === 1 ? "" : "s"} imported.`);
      await loadNewsletter();
    } catch (importError) {
      console.error("[Newsletter] failed to import CSV", importError);
      setError(importError instanceof Error ? importError.message : "Could not import CSV.");
      setState("error");
    } finally {
      event.target.value = "";
    }
  }

  async function onSendCampaign() {
    setFeedback("");
    setError("");

    if (!title.trim() || !body.trim()) {
      setError("Title and body are required before sending.");
      return;
    }

    setState("sending");

    try {
      const result = await sendNewsletterCampaign({ title, body, imageFile, slTextureItemName });
      if (result.queued === 0) {
        setFeedback("Campaign saved, but no active subscribers were found.");
      } else if (result.deliveryStats.sent > 0) {
        setFeedback(
          `Queued for ${result.queued} subscriber${result.queued === 1 ? "" : "s"} and sent ${result.deliveryStats.sent} Second Life IM${result.deliveryStats.sent === 1 ? "" : "s"}.`,
        );
      } else if (result.deliveryStats.failed > 0) {
        setFeedback(
          `Queued for ${result.queued} subscriber${result.queued === 1 ? "" : "s"}, but ${result.deliveryStats.failed} delivery ${result.deliveryStats.failed === 1 ? "failed" : "deliveries failed"}.${result.deliveryStats.lastError ? ` ${result.deliveryStats.lastError}` : ""}`,
        );
      } else if (result.deliveryStats.pending > 0) {
        setFeedback(
          `Queued for ${result.queued} subscriber${result.queued === 1 ? "" : "s"}. Delivery is waiting in the Second Life queue.`,
        );
      } else if (result.processWarning) {
        setFeedback(
          `Queued for ${result.queued} subscriber${result.queued === 1 ? "" : "s"}. Delivery processor needs attention: ${result.processWarning}`,
        );
      } else if (result.processed > 0) {
        setFeedback(
          `Queued for ${result.queued} subscriber${result.queued === 1 ? "" : "s"} and sent ${result.processed} Second Life IM${result.processed === 1 ? "" : "s"}.`,
        );
      } else {
        setFeedback(
          `Queued for ${result.queued} subscriber${result.queued === 1 ? "" : "s"}. Delivery is waiting in the queue.`,
        );
      }
      setTitle("");
      setBody("");
      setImageFile(null);
      setSlTextureItemName("");
      await loadNewsletter();
      setNewsletterView("sent");
    } catch (sendError) {
      console.error("[Newsletter] failed to send campaign", sendError);
      setError(sendError instanceof Error ? sendError.message : "Could not send newsletter.");
      setState("error");
    }
  }

  return (
    <div>
      {newsletterView === "compose" ? (
        <div className="max-w-5xl">
          <GlassCard tone="pink" className="p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">NEW NEWSLETTER</div>
                <h2 className="mt-2 font-display text-4xl leading-none">Send to the grid.</h2>
                <p className="mt-2 text-sm text-foreground/60">
                  Text is sent by IM. If you add a texture item name, the prim also gives that texture from its inventory; the uploaded image remains a fallback.
                </p>
              </div>
              <label className="cursor-pointer rounded-full border border-[var(--brand-magenta)] px-5 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--brand-magenta)] transition hover:bg-[var(--brand-magenta)] hover:text-white">
                Import CSV
                <input type="file" accept=".csv,text/csv" onChange={onCsvImport} className="hidden" />
              </label>
            </div>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              className="mt-6 w-full rounded-full border border-foreground/20 bg-background/70 px-5 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)]"
            />
            <textarea
              rows={7}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your promo, release note, or tiny spell..."
              className="mt-4 w-full rounded-2xl border border-foreground/20 bg-background/70 px-5 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)]"
            />

            <input
              value={slTextureItemName}
              onChange={(event) => setSlTextureItemName(event.target.value)}
              placeholder="Exact SL texture name inside the delivery prim · optional"
              className="mt-4 w-full rounded-full border border-foreground/20 bg-background/70 px-5 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)]"
            />

            <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-foreground/20 p-6 text-center transition hover:border-[var(--brand-magenta)] hover:bg-white/25">
              {imagePreview ? (
                <img src={imagePreview} alt="Newsletter preview" className="mx-auto max-h-72 rounded-xl object-contain" />
              ) : (
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                  Add campaign image · optional
                </div>
              )}
              <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
            </label>

            {feedback ? (
              <div className="mt-4 rounded-2xl border border-green-300 bg-green-50 px-5 py-3 text-sm text-green-700">
                {feedback}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-2xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-magenta)]/10 px-5 py-3 text-sm text-[var(--brand-magenta)]">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                {state === "loading" ? "loading" : (
                  <>
                    {activeSubscribers.length} <span>active subscribers</span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => void onSendCampaign()}
                disabled={state === "sending" || state === "importing"}
                className="rounded-full bg-foreground px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background transition hover:bg-[var(--brand-magenta)] disabled:opacity-60"
              >
                {state === "sending" ? "sending..." : "Send to SL →"}
              </button>
            </div>
          </GlassCard>
        </div>
      ) : newsletterView === "sent" ? (
        <SentNewsletterCampaigns campaigns={campaigns} />
      ) : (
        <NewsletterSubscribersPanel
          subscribers={subscribers}
          loading={state === "loading"}
          onSubscriberAdded={loadNewsletter}
        />
      )}
    </div>
  );
}

function NewsletterSubscribersPanel({
  subscribers,
  loading,
  onSubscriberAdded,
}: {
  subscribers: NewsletterSubscriber[];
  loading: boolean;
  onSubscriberAdded: () => Promise<void>;
}) {
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualUuid, setManualUuid] = useState("");
  const [manualState, setManualState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [manualMessage, setManualMessage] = useState("");
  const activeSubscribers = subscribers.filter((subscriber) => subscriber.is_active && !subscriber.unsubscribed_at);

  function formatSubscriberSource(source: string | null | undefined) {
    if (source === "manual") return "manual";
    if (source === "second_life_prim") return "kiosk";
    if (source === "csv_import") return "csv";
    return "kiosk";
  }

  async function onManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualState("saving");
    setManualMessage("");

    try {
      await addNewsletterSubscriber({
        displayName: manualName,
        slAvatarUuid: manualUuid,
      });
      setManualName("");
      setManualUuid("");
      setManualState("saved");
      setManualMessage("Subscriber added.");
      await onSubscriberAdded();
    } catch (addError) {
      console.error("[Newsletter] failed to add subscriber", addError);
      setManualState("error");
      setManualMessage(addError instanceof Error ? addError.message : "Could not add subscriber.");
    }
  }

  const manualAddForm = showManualAdd ? (
    <form onSubmit={(event) => void onManualSubmit(event)} className="border-b border-foreground/10 bg-[var(--brand-pink)]/25 p-6">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)_auto] md:items-end">
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-foreground/45">Subscriber name</span>
          <input
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            placeholder="Marie Whitfield"
            className="mt-2 w-full rounded-full border border-foreground/15 bg-background/75 px-5 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-foreground/45">SL avatar UUID</span>
          <input
            value={manualUuid}
            onChange={(event) => setManualUuid(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="mt-2 w-full rounded-full border border-foreground/15 bg-background/75 px-5 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)]"
          />
        </label>
        <button
          type="submit"
          disabled={manualState === "saving"}
          className="rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white transition hover:bg-foreground disabled:opacity-60"
        >
          {manualState === "saving" ? "Adding..." : "Add"}
        </button>
      </div>
      {manualMessage ? (
        <div
          className={cn(
            "mt-4 rounded-2xl border px-5 py-3 text-sm",
            manualState === "error"
              ? "border-[var(--brand-magenta)]/35 bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
              : "border-green-300 bg-green-50 text-green-700",
          )}
        >
          {manualMessage}
        </div>
      ) : null}
    </form>
  ) : null;

  if (loading) {
    return (
      <GlassCard tone="pink" className="p-8">
        <div className="font-hand text-3xl text-[var(--brand-magenta)]">loading subscribers</div>
      </GlassCard>
    );
  }

  if (subscribers.length === 0) {
    return (
      <GlassCard tone="pink" className="overflow-hidden p-0">
        <div className="flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">SUBSCRIBERS</div>
            <h2 className="mt-2 font-display text-4xl leading-none">No subscribers yet.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
              Add someone manually by name and SL UUID, or import a CSV when you have a bigger list.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowManualAdd((current) => !current)}
            className="rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white transition hover:bg-foreground"
          >
            {showManualAdd ? "Close" : "+ Add subscriber"}
          </button>
        </div>
        {manualAddForm}
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-foreground/10 p-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            LOVE POTION SUBSCRIBERS
          </div>
          <h2 className="mt-2 font-display text-4xl leading-none">The list.</h2>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-foreground/55">
          {activeSubscribers.length} <span>active</span> · {subscribers.length} <span>total</span>
        </div>
        <button
          type="button"
          onClick={() => setShowManualAdd((current) => !current)}
          className="rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white transition hover:bg-foreground"
        >
          {showManualAdd ? "Close" : "+ Add subscriber"}
        </button>
      </div>
      {manualAddForm}

      <div className="divide-y divide-foreground/5">
        {subscribers.map((subscriber) => {
          const displayName =
            subscriber.display_name || subscriber.sl_avatar_name || subscriber.email || "Second Life Resident";
          const active = subscriber.is_active && !subscriber.unsubscribed_at;
          const source = formatSubscriberSource(subscriber.source);

          return (
            <div key={subscriber.id} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)_120px_120px] md:items-center">
              <div className="min-w-0">
                <div className="truncate font-display text-2xl leading-tight">{displayName}</div>
                {subscriber.email ? (
                  <div className="mt-1 truncate text-sm text-foreground/50">{subscriber.email}</div>
                ) : null}
              </div>
              <div className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                {subscriber.sl_avatar_uuid || "no sl uuid"}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-foreground/55">
                {source}
              </div>
              <div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.22em]",
                    active ? "bg-green-100 text-green-700" : "bg-foreground/5 text-foreground/50",
                  )}
                >
                  {active ? "active" : "paused"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function SentNewsletterCampaigns({ campaigns }: { campaigns: NewsletterCampaignWithStats[] }) {
  if (campaigns.length === 0) {
    return (
      <GlassCard tone="pink" className="p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">Sent editions</div>
        <h2 className="mt-2 font-display text-4xl leading-none">No editions yet.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
          Sent newsletters will appear here with the delivery summary.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => {
        const stats = campaign.deliveryStats;
        const expectedTotal = campaign.queued_count || campaign.recipient_count || stats.total;
        const hasError = stats.failed > 0 || Boolean(stats.lastError);

        return (
          <GlassCard key={campaign.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                  {formatPrettyDate(campaign.sent_at || campaign.created_at)}
                </div>
                <h3 className="mt-2 font-display text-3xl leading-none">{campaign.title}</h3>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-foreground/60">{campaign.body}</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-4 py-2 font-mono text-[9px] uppercase tracking-[0.24em]",
                  hasError ? "bg-[var(--brand-magenta)] text-white" : "bg-green-100 text-green-700",
                )}
              >
                {hasError ? "needs check" : "sent"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-foreground/10 bg-white/35 p-4">
                <div className="font-display text-3xl">{stats.sent}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/50">
                  <span>received of</span> {expectedTotal}
                </div>
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-white/35 p-4">
                <div className="font-display text-3xl">{stats.pending}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/50">pending</div>
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-white/35 p-4">
                <div className="font-display text-3xl">{stats.failed}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/50">with error</div>
              </div>
            </div>

            {hasError ? (
              <div className="mt-4 rounded-2xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-magenta)]/10 px-5 py-3 text-sm text-[var(--brand-magenta)]">
                {stats.failed > 0
                  ? `${stats.failed} delivery ${stats.failed === 1 ? "failed" : "deliveries failed"}.`
                  : "Delivery needs attention."}
                {stats.lastError ? ` ${stats.lastError}` : ""}
              </div>
            ) : null}
          </GlassCard>
        );
      })}
    </div>
  );
}

function Locations() {
  const locs = [
    { sim: "Love Potion Mainstore",      region: "Pink Atoll",      visitors: 1240, traffic: "high"   },
    { sim: "Velvet Pose Studio",         region: "Ivory Bay",       visitors: 412,  traffic: "medium" },
    { sim: "Lace Noir Photo Spot",       region: "Noir Hills",      visitors: 188,  traffic: "low"    },
    { sim: "Satin Spell Runway",         region: "Pink Atoll",      visitors: 902,  traffic: "high"   },
    { sim: "Tulle Rose Garden",          region: "Rose Cliffs",     visitors: 305,  traffic: "medium" },
    { sim: "Silk Touch Beach",           region: "Coral Sea",       visitors: 76,   traffic: "low"    },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {locs.map((l, i) => (
        <GlassCard key={l.sim} tone={i % 3 === 1 ? "pink" : "light"} className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            SLURL · sim
          </div>
          <h3 className="mt-1 font-display text-2xl leading-tight">{l.sim}</h3>
          <div className="mt-1 text-sm text-foreground/70">{l.region}</div>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="font-display text-3xl">{l.visitors}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/60">visitors / 7d</div>
            </div>
            <span className={cn(
              "rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]",
              l.traffic === "high"   ? "bg-[var(--brand-magenta)] text-white" :
              l.traffic === "medium" ? "bg-[var(--brand-rose)] text-white"    :
                                       "bg-foreground/10 text-foreground/70",
            )}>{l.traffic}</span>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function Preferences() {
  const prefs = [
    { k: "Post frequency",         v: "1 / month",   o: ["1 / month", "2 / month", "1 / week"] },
    { k: "Auto-archive after",     v: "90 days",     o: ["30 days", "60 days", "90 days"] },
    { k: "Inactivity warning",     v: "21 days",     o: ["7 days", "14 days", "21 days"] },
    { k: "Required platforms",     v: "Flickr",      o: ["Flickr", "Flickr + IG", "Any"] },
    { k: "Default newsletter day", v: "Friday",      o: ["Monday", "Wednesday", "Friday"] },
  ];
  return (
    <div className="grid gap-4">
      {prefs.map((p, i) => (
        <GlassCard key={p.k} tone={i % 2 === 0 ? "light" : "pink"} className="flex items-center justify-between gap-6 p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">Nº 0{i + 1}</div>
            <h3 className="mt-1 font-display text-xl">{p.k}</h3>
          </div>
          <select className="rounded-full border border-foreground/30 bg-background/70 px-4 py-2 font-mono text-xs" defaultValue={p.v}>
            {p.o.map(opt => <option key={opt}>{opt}</option>)}
          </select>
        </GlassCard>
      ))}
    </div>
  );
}

function notificationTypeLabel(type: string | null) {
  const labels: Record<string, string> = {
    account_blocked: "Account update",
    account_reactivated: "Account reactivated",
    deadline_soon: "Deadline soon",
    manual: "HQ note",
    needs_revision: "Needs revision",
    new_message: "New message",
    new_product: "New product",
    post_approved: "Post approved",
    post_rejected: "Post rejected",
  };

  return labels[type ?? "manual"] ?? String(type ?? "manual").replace(/_/g, " ");
}

function formatPrettyDate(value: string | null) {
  if (!value) return "recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Notifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [error, setError] = useState("");

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  async function loadNotifications() {
    try {
      const profile = await getCurrentProfile();
      if (!profile?.id) throw new Error("Profile not found.");
      const rows = await listMyNotifications(profile.id);
      setNotifications(rows);
      setState("ready");
      setError("");
    } catch (loadError) {
      console.error("[Admin] failed to load notifications", loadError);
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
    }
  }

  useEffect(() => {
    void loadNotifications();

    const onNotificationsUpdated = () => void loadNotifications();
    window.addEventListener("notifications-updated", onNotificationsUpdated);
    window.addEventListener("focus", onNotificationsUpdated);

    return () => {
      window.removeEventListener("notifications-updated", onNotificationsUpdated);
      window.removeEventListener("focus", onNotificationsUpdated);
    };
  }, []);

  async function onMarkRead(notificationId: string) {
    const previous = notifications;
    const readAt = new Date().toISOString();

    setState("saving");
    setNotifications((rows) =>
      rows.map((row) => (row.id === notificationId ? { ...row, read_at: row.read_at ?? readAt } : row)),
    );

    try {
      await markNotificationRead(notificationId);
      window.dispatchEvent(new Event("notifications-updated"));
      setState("ready");
    } catch (markError) {
      console.error("[Admin] failed to mark notification read", markError);
      setNotifications(previous);
      setState("error");
      setError(markError instanceof Error ? markError.message : "Could not update notification.");
    }
  }

  async function onMarkAllRead() {
    const previous = notifications;
    const readAt = new Date().toISOString();

    setState("saving");
    setNotifications((rows) => rows.map((row) => (row.read_at ? row : { ...row, read_at: readAt })));

    try {
      await markAllNotificationsRead();
      window.dispatchEvent(new Event("notifications-updated"));
      setState("ready");
    } catch (markError) {
      console.error("[Admin] failed to mark notifications read", markError);
      setNotifications(previous);
      setState("error");
      setError(markError instanceof Error ? markError.message : "Could not update notifications.");
    }
  }

  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            Notification center
          </div>
          <p className="mt-2 text-sm text-foreground/55">
            {unreadCount > 0
              ? `${unreadCount} unread signal${unreadCount === 1 ? "" : "s"} for the team.`
              : "No unread signals right now."}
          </p>
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            disabled={state === "saving"}
            onClick={() => void onMarkAllRead()}
            className="rounded-full bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-background transition hover:bg-[var(--brand-magenta)] disabled:opacity-60"
          >
            {state === "saving" ? "saving" : "mark all read"}
          </button>
        ) : null}
      </div>

      {state === "loading" ? (
        <div className="mt-5 rounded-2xl border border-dashed border-foreground/15 p-8 text-center">
          <div className="font-hand text-3xl text-[var(--brand-magenta)]">loading signals</div>
        </div>
      ) : state === "error" ? (
        <div className="mt-5 rounded-2xl border border-[var(--brand-magenta)]/25 bg-[var(--brand-magenta)]/5 p-5 text-sm text-[var(--brand-magenta)]">
          {error || "Could not load notifications."}
        </div>
      ) : notifications.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-foreground/15 p-8 text-center">
          <div className="font-hand text-3xl text-[var(--brand-magenta)]">no signals yet</div>
          <p className="mt-2 text-sm text-foreground/55">
            Replies, app notices, and system alerts will land here.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {notifications.map((notification) => {
            const unread = !notification.read_at;
            const date = notification.created_at ?? notification.sent_at ?? null;

            return (
              <div
                key={notification.id}
                className={cn(
                  "rounded-2xl border p-5 transition",
                  unread
                    ? "border-[var(--brand-magenta)]/40 bg-[var(--brand-magenta)]/10 shadow-[0_20px_45px_rgba(219,24,97,0.12)]"
                    : "border-foreground/10 bg-white/30 opacity-75",
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div
                    className={cn(
                      "mt-1 h-3 w-3 shrink-0 rounded-full",
                      unread ? "bg-[var(--brand-magenta)]" : "bg-foreground/20",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45">
                      {notificationTypeLabel(notification.type)} · {formatPrettyDate(date)}
                    </div>
                    <h3 className="mt-2 font-display text-2xl">{notification.title}</h3>
                    {notification.body ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/65">
                        {notification.body}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {notification.action_url ? (
                        <a
                          href={notification.action_url}
                          className="rounded-full border border-foreground/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] transition hover:bg-foreground hover:text-background"
                        >
                          open
                        </a>
                      ) : null}
                      {unread ? (
                        <button
                          type="button"
                          disabled={state === "saving"}
                          onClick={() => void onMarkRead(notification.id)}
                          className="rounded-full bg-[var(--brand-magenta)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white transition hover:bg-foreground disabled:opacity-60"
                        >
                          mark read
                        </button>
                      ) : (
                        <span className="rounded-full bg-foreground/5 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/45">
                          read
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

function Subscribers() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [error, setError] = useState("");

  const active = subscribers.filter((subscriber) => subscriber.is_active && !subscriber.unsubscribed_at);
  const paused = subscribers.length - active.length;

  async function loadSubscribers() {
    try {
      const rows = await listNewsletterSubscribers();
      setSubscribers(rows);
      setState("ready");
      setError("");
    } catch (loadError) {
      console.error("[Subscribers] failed to load subscribers", loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load subscribers.");
      setState("error");
    }
  }

  useEffect(() => {
    void loadSubscribers();
  }, []);

  async function onToggle(subscriber: NewsletterSubscriber) {
    setState("saving");
    try {
      await setNewsletterSubscriberActive(subscriber.id, !subscriber.is_active);
      await loadSubscribers();
    } catch (toggleError) {
      console.error("[Subscribers] failed to update subscriber", toggleError);
      setError(toggleError instanceof Error ? toggleError.message : "Could not update subscriber.");
      setState("error");
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-4">
      <GlassCard tone="pink" className="md:col-span-1 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">TOTAL</div>
        <div className="mt-2 font-display text-6xl leading-none">{subscribers.length}</div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">subscribers</div>
        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between"><span>Active</span><span className="font-mono">{active.length}</span></div>
          <div className="flex justify-between"><span>Paused</span><span className="font-mono">{paused}</span></div>
          <div className="flex justify-between"><span>Source</span><span className="font-mono">SL + CSV</span></div>
        </div>
      </GlassCard>
      <GlassCard className="md:col-span-3 overflow-x-auto p-0">
        {error ? (
          <div className="m-5 rounded-2xl border border-[var(--brand-magenta)]/25 bg-[var(--brand-magenta)]/10 p-4 text-sm text-[var(--brand-magenta)]">
            {error}
          </div>
        ) : null}
        <table className="w-full text-sm">
          <thead className="border-b border-foreground/10">
            <tr className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              <th className="px-6 py-4 text-left">Name</th>
              <th className="px-6 py-4 text-left">SL UUID</th>
              <th className="px-6 py-4 text-left">Lang</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {state === "loading" ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center font-hand text-2xl text-[var(--brand-magenta)]">
                  loading subscribers
                </td>
              </tr>
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center font-hand text-2xl text-[var(--brand-magenta)]">
                  no subscribers yet
                </td>
              </tr>
            ) : subscribers.map((subscriber) => (
              <tr key={subscriber.id} className="border-b border-foreground/5 hover:bg-foreground/5">
                <td className="px-6 py-4">
                  <div className="font-display text-lg">
                    {subscriber.display_name || subscriber.sl_avatar_name || subscriber.email || "Second Life Resident"}
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/45">
                    {subscriber.source}
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-[10px] text-foreground/60">{subscriber.sl_avatar_uuid ?? "missing"}</td>
                <td className="px-6 py-4 font-mono text-xs uppercase">{subscriber.language_preference}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.24em]",
                    subscriber.is_active && !subscriber.unsubscribed_at
                      ? "bg-green-50 text-green-700"
                      : "bg-foreground/5 text-foreground/50",
                  )}>
                    {subscriber.is_active && !subscriber.unsubscribed_at ? "active" : "paused"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    disabled={state === "saving"}
                    onClick={() => void onToggle(subscriber)}
                    className="rounded-full border border-foreground/15 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.22em] transition hover:bg-foreground hover:text-background disabled:opacity-60"
                  >
                    {subscriber.is_active ? "pause" : "reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
