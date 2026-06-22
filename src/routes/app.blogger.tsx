import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Bell, Check, Copy, Download, Plus, Send, Trash2, X } from "lucide-react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { products } from "@/mocks/data";
import { cn } from "@/lib/utils";
import bloggerAvatar from "@/assets/blogger-avatar.jpg";
import { useLang, type Lang } from "@/i18n/dict";
import { getCurrentProfile, leaveBloggerProgram, signOut, updateCurrentPassword, updateCurrentProfile } from "@/integrations/supabase/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  claimProductForBlogger,
  getLatestSubmissionForProduct,
  listAvailableProductsForBlogger,
  listProductClaimsForBlogger,
  listSubmissionSummariesForBlogger,
  statusLabel,
  submitLinksForProduct,
  type BloggerProductClaimSummary,
  type BloggerProduct,
  type BloggerSubmissionSummary,
  type SubmissionCommentProfile,
} from "@/integrations/supabase/blogger";
import { listSharedResources } from "@/integrations/supabase/resources";
import {
  listInboxMessages,
  markPersonalInboxMessagesRead,
  notifyStaffSecondLifeQuietly,
  sendInternalReply,
  type InboxMessage,
} from "@/integrations/supabase/messages";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/integrations/supabase/notifications";
import type { SharedResource, SubmissionStatus } from "@/integrations/supabase/database.types";
import type { AuthProfile } from "@/integrations/supabase/auth";

type Tab = "home" | "products" | "posts" | "goodies" | "notifications" | "inbox" | "profile";
type Status = "active" | "vacation" | "busy" | "offline";
type Product = {
  id: string;
  name: string;
  category: string;
  img: string;
  added: string;
  expires: string;
  deadline: string;
  location: string;
  recommendation: string;
  vendorPoster: string | null;
  shortDescription: string | null;
};
type PortfolioLink = {
  id: number;
  platform: string;
  url: string;
  note: string;
};
type ProductClaimState = "idle" | "claiming" | "claimed" | "delivered" | "failed" | "error";

function getProductClaimState(claim?: BloggerProductClaimSummary, submission?: BloggerSubmissionSummary): ProductClaimState {
  if (submission || claim?.status === "delivered") return "delivered";
  if (claim?.status === "failed") return "failed";
  if (claim) return "claimed";
  return "idle";
}

export const Route = createFileRoute("/app/blogger")({
  validateSearch: (s: Record<string, unknown>): { section?: Tab; tour?: "blogger" } => {
    const rawSection = typeof s.section === "string" ? s.section : undefined;
    const validSections: Tab[] = ["home", "products", "posts", "goodies", "notifications", "inbox", "profile"];
    return {
      section: validSections.includes(rawSection as Tab) ? (rawSection as Tab) : undefined,
      tour: s.tour === "blogger" || rawSection === "help" ? "blogger" : undefined,
    };
  },
  component: BloggerDash,
});

const TITLES: Record<Tab, { eyebrow: string; title: string; note: string }> = {
  home: { eyebrow: "BLOGGER · Nº 01", title: "Bonjour.", note: "style on" },
  products: { eyebrow: "STUDIO · PRODUCTS", title: "The wardrobe.", note: "pick a spell" },
  posts: { eyebrow: "STUDIO · POSTS", title: "Your gallery.", note: "share the magic" },
  goodies: { eyebrow: "STUDIO · GOODIES", title: "Bag of goodies.", note: "take what you need" },
  notifications: { eyebrow: "STUDIO · NOTICES", title: "Signal spells.", note: "fresh sparks" },
  inbox: { eyebrow: "STUDIO · MAILBOX", title: "Messages.", note: "open with care" },
  profile: { eyebrow: "STUDIO · PROFILE", title: "About you.", note: "set the scene" },
};

const BLOGGER_TOUR_SEEN_KEY_PREFIX = "love-potion-blogger-tour-seen:";

function mapAvailabilityToStatus(value?: string | null): Status {
  if (value === "vacation") return "vacation";
  if (value === "busy") return "busy";
  if (value === "offline") return "offline";
  return "active";
}

function mapStatusToAvailability(value: Status): "available" | "vacation" | "busy" | "offline" {
  if (value === "active") return "available";
  return value;
}

function countPersonalUnread(messages: InboxMessage[]) {
  return messages.filter((message) => message.scope === "personal" && !message.read_at).length;
}

function BloggerDash() {
  const navigate = useNavigate({ from: "/app/blogger" });
  const language = useLang();
  const { section, tour } = Route.useSearch();
  const tab: Tab = section ?? "home";
  const setTab = (v: Tab) =>
    navigate({
      search: (prev) => {
        const { tour: _tour, ...rest } = prev as Record<string, unknown>;
        return { ...rest, section: v === "home" ? undefined : v };
      },
    } as never);
  const closeTour = () => {
    if (profileId) window.localStorage.setItem(`${BLOGGER_TOUR_SEEN_KEY_PREFIX}${profileId}`, "true");
    void navigate({
      search: (prev) => {
        const { tour: _tour, ...rest } = prev as Record<string, unknown>;
        return { ...rest, section: tab === "home" ? undefined : tab };
      },
    } as never);
  };

  // Profile state (lifted so overlay note appears across Overview too)
  const [photo, setPhoto] = useState<string>(bloggerAvatar);
  const [overlayNote, setOverlayNote] = useState<string>("on a velvet night ♡");
  const [status, setStatus] = useState<Status>("active");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [productRows, setProductRows] = useState<Product[]>([]);
  const [submissions, setSubmissions] = useState<BloggerSubmissionSummary[]>([]);
  const [claims, setClaims] = useState<BloggerProductClaimSummary[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickNoteState, setQuickNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [goodies, setGoodies] = useState<SharedResource[]>([]);
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationState, setNotificationState] = useState<"idle" | "saving" | "error">("idle");
  const [hasLeftProgram, setHasLeftProgram] = useState(false);

  const displayName = profile?.display_name || profile?.full_name || profile?.email || "Blogger";
  const isAccountBlocked = profile?.account_status === "blocked";
  const isAccountPending = profile?.account_status === "pending";
  const isAccountLeft = profile?.account_status === "left";
  const accountLocked = isAccountBlocked || isAccountPending || isAccountLeft;
  const accountNotice =
    profile?.account_status === "blocked"
      ? {
          title: "Account paused by monthly rule.",
          body: "Your account is blocked because there was no approved post in the previous month. You can still review your history, but claiming products and submitting links are paused until Love Potion HQ reactivates you.",
        }
      : profile?.account_status === "pending"
        ? {
            title: "Account waiting for approval.",
            body: "Your account exists, but it is still pending. Product claims and submissions unlock once Love Potion HQ activates your profile.",
          }
        : profile?.account_status === "left"
          ? {
              title: "You left the blogger program.",
              body: "Your account history stays saved, but product claims and submissions are closed unless Love Potion HQ decides to reactivate you.",
            }
          : null;
  const meta = {
    ...TITLES[tab],
    title:
      tab === "home"
        ? `${language === "es" ? "Hola" : "Bonjour"}, ${displayName.split(" ")[0] || displayName}.`
        : TITLES[tab].title,
  };
  const submissionByProduct = useMemo(
    () =>
      submissions.reduce<Record<string, BloggerSubmissionSummary>>((acc, row) => {
        if (!acc[row.product_id]) acc[row.product_id] = row;
        return acc;
      }, {}),
    [submissions],
  );
  const claimByProduct = useMemo(
    () =>
      claims.reduce<Record<string, BloggerProductClaimSummary>>((acc, row) => {
        if (!acc[row.product_id]) acc[row.product_id] = row;
        return acc;
      }, {}),
    [claims],
  );

  useEffect(() => {
    let mounted = true;

    async function loadBloggerData() {
      try {
        const profile = await getCurrentProfile();
        if (!mounted || !profile?.id) return;
        setProfileId(profile.id);
        setProfile(profile);
        setHasLeftProgram(profile.account_status === "left");
        setPhoto(getSafeAvatarUrl(profile.avatar_url));
        setOverlayNote(profile.status_message || "");
        setStatus(mapAvailabilityToStatus(profile.availability_status));

        const [liveProducts, liveSubmissions, liveClaims, sharedGoodies, inboxMessages, notificationRows] = await Promise.all([
          listAvailableProductsForBlogger(),
          listSubmissionSummariesForBlogger(profile.id),
          listProductClaimsForBlogger(profile.id).catch((error) => {
            console.error("[Blogger] Failed to load product claims", error);
            return [] as BloggerProductClaimSummary[];
          }),
          listSharedResources(),
          listInboxMessages(profile.id),
          listMyNotifications(profile.id).catch((error) => {
            console.error("[Blogger] Failed to load notifications", error);
            return [] as AppNotification[];
          }),
        ]);

        if (!mounted) return;
        setProductRows(liveProducts.map((product) => mapProductForUi(product, language)));
        setSubmissions(liveSubmissions);
        setClaims(liveClaims);
        setGoodies(sharedGoodies);
        setMailUnreadCount(countPersonalUnread(inboxMessages));
        setNotifications(notificationRows);
        setNotificationUnreadCount(notificationRows.filter((row) => !row.read_at).length);
        setLoadState("ready");
      } catch (error) {
        console.error("[Blogger] Failed to load live products", error);
        if (!mounted) return;
        setProductRows(products.map((product) => mapMockProductForUi(product, language)));
        setLoadState("fallback");
      }
    }

    void loadBloggerData();
    return () => {
      mounted = false;
    };
  }, [language]);

  useEffect(() => {
    if (!profile?.id || profile.role !== "blogger" || hasLeftProgram || tour === "blogger") return;
    const seenKey = `${BLOGGER_TOUR_SEEN_KEY_PREFIX}${profile.id}`;
    if (window.localStorage.getItem(seenKey) === "true") return;

    void navigate({
      search: (prev) => ({ ...(prev as object), tour: "blogger" }),
      replace: true,
    } as never);
  }, [hasLeftProgram, navigate, profile?.id, profile?.role, tour]);

  async function handleQuickNoteSave(nextNote: string) {
    if (!profile) return;
    setQuickNoteState("saving");
    try {
      const updated = await updateCurrentProfile({
        status_message: nextNote.trim() || null,
      });
      setProfile(updated);
      setOverlayNote(updated.status_message || "");
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: updated }));
      setQuickNoteState("saved");
      window.setTimeout(() => setQuickNoteState("idle"), 1800);
    } catch (error) {
      console.error("[Blogger] quick note save failed", error);
      setQuickNoteState("error");
      window.setTimeout(() => setQuickNoteState("idle"), 2200);
    }
  }

  async function handleMarkNotificationRead(notificationId: string) {
    const previous = notifications;
    const target = previous.find((row) => row.id === notificationId);
    const readAt = new Date().toISOString();
    setNotificationState("saving");
    setNotifications((rows) =>
      rows.map((row) => (row.id === notificationId ? { ...row, read_at: row.read_at ?? readAt } : row)),
    );
    if (!target?.read_at) setNotificationUnreadCount((count) => Math.max(0, count - 1));

    try {
      await markNotificationRead(notificationId);
      window.dispatchEvent(new Event("notifications-updated"));
      setNotificationState("idle");
    } catch (error) {
      console.error("[Blogger] failed to mark notification read", error);
      setNotifications(previous);
      setNotificationUnreadCount(previous.filter((row) => !row.read_at).length);
      setNotificationState("error");
      window.setTimeout(() => setNotificationState("idle"), 2200);
    }
  }

  async function handleMarkAllNotificationsRead() {
    const previous = notifications;
    const readAt = new Date().toISOString();
    setNotificationState("saving");
    setNotifications((rows) => rows.map((row) => (row.read_at ? row : { ...row, read_at: readAt })));
    setNotificationUnreadCount(0);

    try {
      await markAllNotificationsRead();
      window.dispatchEvent(new Event("notifications-updated"));
      setNotificationState("idle");
    } catch (error) {
      console.error("[Blogger] failed to mark all notifications read", error);
      setNotifications(previous);
      setNotificationUnreadCount(previous.filter((row) => !row.read_at).length);
      setNotificationState("error");
      window.setTimeout(() => setNotificationState("idle"), 2200);
    }
  }

  if (hasLeftProgram) {
    return <LeftProgramSuccess language={profile?.language_preference ?? "en"} />;
  }

  return (
    <div className="px-6 py-10 md:px-12">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {meta.eyebrow}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">{meta.title}</h1>
        </div>
        <HandwrittenNote>{meta.note}</HandwrittenNote>
      </div>

      <div className="mt-8">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "home", label: "Overview", sub: "01" },
            { id: "products", label: "Products", sub: "02" },
            { id: "posts", label: "Posts", sub: "03" },
            { id: "goodies", label: "Bag of goodies", sub: "04" },
            { id: "notifications", label: "Notifications", sub: "05", badge: notificationUnreadCount },
            { id: "inbox", label: "Mailbox", sub: "06", badge: mailUnreadCount },
            { id: "profile", label: "Profile", sub: "07" },
          ]}
        />
      </div>

      <div className="mt-8">
        {accountNotice ? (
          <GlassCard tone="pink" className="mb-6 p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              Access notice
            </div>
            <div className="mt-2 font-display text-2xl">{accountNotice.title}</div>
            <p className="mt-2 max-w-3xl text-sm text-foreground/70">{accountNotice.body}</p>
          </GlassCard>
        ) : null}
        {tab === "home" && (
          <Overview
            photo={photo}
            note={overlayNote}
            status={status}
            accountStatus={profile?.account_status ?? "active"}
            displayName={displayName}
            products={productRows}
            submissions={submissions}
            onOpenProduct={setSelectedProduct}
            onQuickSaveNote={handleQuickNoteSave}
            quickNoteState={quickNoteState}
          />
        )}
        {tab === "products" && (
          <ProductsTab
            products={productRows}
            onOpenProduct={setSelectedProduct}
            submissionByProduct={submissionByProduct}
            claimByProduct={claimByProduct}
            loading={loadState === "loading"}
            locked={accountLocked}
          />
        )}
        {tab === "posts" && (
          <PostsTab
            products={productRows}
            submissions={submissions}
            onOpenProduct={setSelectedProduct}
          />
        )}
        {tab === "goodies" && <GoodiesTab resources={goodies} />}
        {tab === "notifications" && (
          <NotificationsTab
            notifications={notifications}
            unreadCount={notificationUnreadCount}
            busy={notificationState === "saving"}
            state={notificationState}
            onMarkRead={handleMarkNotificationRead}
            onMarkAllRead={handleMarkAllNotificationsRead}
          />
        )}
        {tab === "inbox" && <InboxTab profileId={profileId} onUnreadChange={setMailUnreadCount} />}
        {tab === "profile" && (
          <ProfileTab
            photo={photo}
            setPhoto={setPhoto}
            note={overlayNote}
            setNote={setOverlayNote}
            status={status}
            setStatus={setStatus}
            profile={profile}
            onLeftProgram={(updated) => {
              setProfile(updated);
              setHasLeftProgram(true);
            }}
            onProfileUpdated={(updated) => {
              setProfile(updated);
              setHasLeftProgram(updated.account_status === "left");
              setPhoto(getSafeAvatarUrl(updated.avatar_url));
              setOverlayNote(updated.status_message || "");
              setStatus(mapAvailabilityToStatus(updated.availability_status));
            }}
          />
        )}
      </div>

      {tour === "blogger" ? <BloggerVirtualTour onDone={closeTour} /> : null}

      {selectedProduct && (
        <ProductSubmissionModal
          product={selectedProduct}
          submission={submissionByProduct[selectedProduct.id]}
          submissionHistory={submissions.filter((row) => row.product_id === selectedProduct.id)}
          claim={claimByProduct[selectedProduct.id]}
          profileId={profileId}
          accountLocked={accountLocked}
          accountStatus={profile?.account_status ?? "active"}
          onClose={() => setSelectedProduct(null)}
          onClaim={(claim) => {
            setClaims((current) => [
              claim,
              ...current.filter((item) => item.product_id !== claim.product_id),
            ]);
          }}
          onSubmit={(submission) => {
            setSubmissions((current) => [submission, ...current]);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}

function mapProductForUi(product: BloggerProduct, language: Lang = "en"): Product {
  const image = product.editorial_image_url ?? product.image_url ?? "";
  const releaseDate = product.release_date ? formatPrettyDate(product.release_date, language) : language === "es" ? "recientemente" : "recently";
  const deadlineDate = product.deadline_at ? formatPrettyDate(product.deadline_at, language) : language === "es" ? "Sin plazo" : "No deadline";
  const deadlineLeft = product.deadline_at ? daysUntil(product.deadline_at) : null;
  const expires =
    deadlineLeft === null
      ? language === "es"
        ? "sin plazo"
        : "no deadline"
      : deadlineLeft <= 0
        ? language === "es"
          ? "plazo vencido"
          : "deadline reached"
        : language === "es"
          ? `${deadlineLeft} días restantes`
          : `${deadlineLeft} days left`;

  return {
    id: product.id,
    name: product.name,
    category: product.category ?? "General",
    img: image,
    added: releaseDate,
    expires,
    deadline: deadlineDate,
    location: product.second_life_link ?? (language === "es" ? "Sin ubicación" : "No location provided"),
    recommendation: product.blogging_recommendations ?? (language === "es" ? "Aún no hay recomendaciones." : "No recommendations yet."),
    vendorPoster: product.vendor_poster_url,
    shortDescription: product.short_description,
  };
}

function mapMockProductForUi(product: (typeof products)[number], language: Lang = "en"): Product {
  return {
    id: product.id,
    name: product.name,
    category: "General",
    img: product.img,
    added: language === "es" ? "recientemente" : product.added,
    expires: language === "es" ? "sin plazo" : product.expires,
    deadline: language === "es" ? "Sin plazo" : product.deadline,
    location: product.location,
    recommendation: product.recommendation,
    vendorPoster: product.vendorPoster,
    shortDescription: null,
  };
}

function formatPrettyDate(value: string, language: Lang = "en") {
  return new Date(value).toLocaleDateString(language === "es" ? "es" : undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysUntil(value: string) {
  const now = new Date();
  const target = new Date(value);
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
  return diff;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getSafeAvatarUrl(value?: string | null) {
  if (!value || value.startsWith("blob:")) return bloggerAvatar;
  return value;
}

function getProfileDisplayName(profile?: SubmissionCommentProfile | null) {
  return profile?.display_name ?? profile?.full_name ?? profile?.email ?? "Love Potion HQ";
}

function getCommentStatus(profile?: SubmissionCommentProfile | null) {
  const note = profile?.status_message?.trim();
  if (note) return note;
  if (profile?.availability_status === "available") return "Available";
  if (profile?.availability_status === "vacation") return "On vacation";
  if (profile?.availability_status === "busy") return "Busy";
  if (profile?.availability_status === "offline") return "Offline";
  return "Love Potion";
}

function statusBadgeClass(status: SubmissionStatus) {
  if (status === "approved") return "bg-green-100 text-green-700";
  if (status === "needs_revision") return "bg-amber-100 text-amber-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-foreground/10 text-foreground/80";
}

/* ───────── Avatar with Instagram-style overlay note ───────── */

const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  vacation: "On vacation",
  busy: "Busy",
  offline: "Offline",
};
const STATUS_COLOR: Record<Status, string> = {
  active: "bg-[var(--brand-rose)]",
  vacation: "bg-[var(--brand-magenta)]",
  busy: "bg-foreground/60",
  offline: "bg-slate-400",
};

function AvatarCard({
  photo,
  note,
  status,
  size = "lg",
}: {
  photo: string;
  note: string;
  status: Status;
  size?: "sm" | "lg";
}) {
  // Instagram-style: max 2 lines, big condensed display type centered
  const lines = (note || "").split("\n").slice(0, 2);
  const noteLength = lines.join(" ").trim().length;
  const longNote = noteLength > 28;
  const baseSize = size === "lg" ? "clamp(1.3rem, 3.2vw, 2.25rem)" : "1.1rem";
  const compactSize = size === "lg" ? "clamp(1.1rem, 2.8vw, 1.85rem)" : "1rem";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        size === "lg" ? "aspect-[4/5]" : "aspect-square",
      )}
    >
      <img src={photo} alt="avatar" className="h-full w-full object-cover" />
      {/* gradient for legibility */}
      {note && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/15 to-black/55" />
      )}
      {/* status pill */}
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 backdrop-blur-md">
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLOR[status])} />
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white">
          {STATUS_LABEL[status]}
        </span>
      </div>
      {/* overlay note */}
      {note && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="text-center">
            {lines.map((l, i) => (
              <div
                key={i}
                className="font-display uppercase leading-[0.95] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                style={{ fontSize: longNote ? compactSize : baseSize }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCommentBubble({
  label,
  profile,
  children,
}: {
  label: string;
  profile?: SubmissionCommentProfile | null;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-white/45 bg-white/45 p-3 shadow-sm backdrop-blur-md">
      <div className="flex gap-3">
        <div className="relative h-14 w-14 shrink-0">
          <img
            src={getSafeAvatarUrl(profile?.avatar_url)}
            alt=""
            className="h-14 w-14 rounded-2xl object-cover shadow-sm"
          />
          <span className="absolute -right-2 -top-2 max-w-[8rem] truncate rounded-full bg-[var(--brand-rose)] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.18em] text-white shadow-md">
            {getCommentStatus(profile)}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--brand-magenta)]">
            {label} · {getProfileDisplayName(profile)}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-foreground/75">{children}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────── Tabs ───────── */

function Overview({
  photo,
  note,
  status,
  accountStatus,
  displayName,
  products,
  submissions,
  onOpenProduct,
  onQuickSaveNote,
  quickNoteState,
}: {
  photo: string;
  note: string;
  status: Status;
  accountStatus: string;
  displayName: string;
  products: Product[];
  submissions: BloggerSubmissionSummary[];
  onOpenProduct: (product: Product) => void;
  onQuickSaveNote: (nextNote: string) => Promise<void>;
  quickNoteState: "idle" | "saving" | "saved" | "error";
}) {
  const [draftNote, setDraftNote] = useState(note);

  useEffect(() => {
    setDraftNote(note);
  }, [note]);

  const submittedItems = submissions
    .map((submission) => ({
      submission,
      product: products.find((product) => product.id === submission.product_id),
    }))
    .filter((item): item is { submission: BloggerSubmissionSummary; product: Product } => Boolean(item.product))
    .slice(0, 4);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <GlassCard className="md:col-span-1 overflow-hidden p-0">
        <AvatarCard photo={photo} note={note} status={status} />
        <div className="relative p-5 pr-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            PROFILE
          </div>
          <div className="mt-1 font-display text-2xl">{displayName}</div>
          <p className="mt-1 font-hand text-lg text-[var(--brand-magenta)] leading-tight">
            "{note || "—"}"
          </p>
          <div className="pointer-events-none absolute bottom-5 right-3 select-none font-display text-3xl leading-none tracking-tight text-foreground/[0.08] [writing-mode:vertical-rl] [text-orientation:mixed]">
            love potion.
          </div>
          <div className="mt-3 rounded-xl border border-foreground/15 bg-background/70 p-3">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/55">
              Quick note · 60 chars
            </div>
            <textarea
              value={draftNote}
              onChange={(event) => {
                const lines = event.target.value.split("\n").slice(0, 2);
                setDraftNote(lines.join("\n").slice(0, NOTE_MAX));
              }}
              rows={2}
              maxLength={NOTE_MAX}
              className="w-full resize-none rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm leading-snug focus:border-[var(--brand-magenta)] focus:outline-none"
              placeholder="Write your floating note..."
            />
            <div className="mt-2 flex items-center justify-between">
              <span
                className={cn(
                  "text-xs",
                  quickNoteState === "saved" && "text-green-700",
                  quickNoteState === "error" && "text-rose-700",
                  quickNoteState !== "saved" && quickNoteState !== "error" && "text-foreground/55",
                )}
              >
                {quickNoteState === "saving" && "Saving..."}
                {quickNoteState === "saved" && "Saved"}
                {quickNoteState === "error" && "Could not save"}
                {quickNoteState === "idle" && `${draftNote.length}/${NOTE_MAX}`}
              </span>
              <button
                onClick={() => void onQuickSaveNote(draftNote)}
                disabled={quickNoteState === "saving"}
                className="rounded-full bg-[var(--brand-magenta)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white disabled:opacity-60"
              >
                {quickNoteState === "saving" ? "Saving" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </GlassCard>
      <div className="md:col-span-2 grid gap-6 sm:grid-cols-2">
        <GlassCard tone="pink">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            STATUS
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="font-display text-3xl">{STATUS_LABEL[status]}</div>
            <span
              className={cn(
                "rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.22em]",
                accountStatus === "blocked"
                  ? "bg-rose-100 text-rose-700"
                  : accountStatus === "pending"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700",
              )}
            >
              {accountStatus}
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground/70">
            {accountStatus === "blocked"
              ? "Claims and submissions are paused until HQ reactivates your profile."
              : accountStatus === "pending"
                ? "Your profile is waiting for Love Potion HQ approval."
              : "Keep one approved post per month to stay active."}
          </p>
        </GlassCard>
        <GlassCard>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            NEXT DEADLINE
          </div>
          <div className="mt-2 font-display text-3xl">14 days</div>
          <p className="mt-2 text-sm text-foreground/70">One post per month minimum.</p>
        </GlassCard>
        <GlassCard className="sm:col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            RULES
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>· 1 post / month minimum</li>
            <li>· Credit "Love Potion"</li>
            <li>· Tag #lovepotionsl on Flickr</li>
          </ul>
        </GlassCard>

        <GlassCard className="sm:col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            Submitted posts
          </div>
          {submittedItems.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/60">No submissions yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {submittedItems.map((item, index) => (
                <div key={item.submission.id}>
                  <button
                    onClick={() => onOpenProduct(item.product)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-[var(--brand-magenta)]",
                      index === 0
                        ? "border-foreground/15 bg-background/80"
                        : "border-foreground/8 bg-background/50 opacity-70 grayscale-[0.25]",
                    )}
                  >
                    <img
                      src={item.product.img}
                      alt={item.product.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-lg leading-tight">{item.product.name}</div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/55">
                        {new Date(item.submission.submitted_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.22em]",
                        statusBadgeClass(item.submission.status),
                      )}
                    >
                      {statusLabel(item.submission.status)}
                    </span>
                  </button>
                  {item.submission.review_comment ? (
                    <div className="mx-1 -mt-1 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/75">
                      Review note: {item.submission.review_comment}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function ProductsTab({
  products,
  onOpenProduct,
  submissionByProduct,
  claimByProduct,
  loading,
  locked,
}: {
  products: Product[];
  onOpenProduct: (product: Product) => void;
  submissionByProduct: Record<string, BloggerSubmissionSummary>;
  claimByProduct: Record<string, BloggerProductClaimSummary>;
  loading: boolean;
  locked: boolean;
}) {
  if (loading) {
    return (
      <GlassCard tone="pink" className="p-8">
        <div className="font-hand text-3xl text-[var(--brand-magenta)]">loading products...</div>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {products.slice(0, 6).map((p) => {
        const submission = submissionByProduct[p.id];
        const claim = claimByProduct[p.id];
        const claimBadge =
          claim?.status === "delivered"
            ? "Delivered"
            : claim?.status === "failed"
              ? "Delivery failed"
            : claim
              ? "Delivery pending"
              : null;
        return (
        <GlassCard key={p.id} className="overflow-hidden p-0">
          <img
            src={p.img}
            alt={p.name}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover"
          />
          <div className="p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {p.added}
            </div>
            <h3 className="mt-1 font-display text-2xl">{p.name}</h3>
            {p.shortDescription ? (
              <p className="mt-1 text-sm italic text-foreground/70">“{p.shortDescription}”</p>
            ) : null}
            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
              <span>Deadline</span> · {p.deadline}
            </div>
            {submission ? (
              <div className="mt-2 inline-flex rounded-full bg-foreground/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/80">
                {statusLabel(submission.status)}
              </div>
            ) : null}
            {claimBadge && !submission ? (
              <div
                className={cn(
                  "mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[9px] uppercase tracking-[0.25em] shadow-sm",
	                  claim.status === "delivered"
	                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-100"
	                    : claim.status === "failed"
	                      ? "border-rose-200 bg-rose-50 text-rose-700 shadow-rose-100"
	                      : "border-amber-200 bg-amber-50 text-amber-700 shadow-amber-100",
	                )}
	              >
	                <Check className="h-3.5 w-3.5" />
                {claimBadge}
              </div>
            ) : null}
            {locked && !submission && !claim ? (
              <div className="mt-2 inline-flex rounded-full bg-rose-100 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-rose-700">
                Account paused
              </div>
            ) : null}
            <button
              onClick={() => onOpenProduct(p)}
              className="mt-4 w-full rounded-full bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]"
            >
              {submission
                ? "View submission →"
                : claim?.status === "delivered"
                  ? "Open delivered dossier →"
                  : claim
                    ? "Retry delivery →"
                    : "Open dossier →"}
            </button>
          </div>
        </GlassCard>
      )})}
    </div>
  );
}

function PostsTab({
  products,
  submissions,
  onOpenProduct,
}: {
  products: Product[];
  submissions: BloggerSubmissionSummary[];
  onOpenProduct: (product: Product) => void;
}) {
  const rows = submissions
    .map((submission) => ({
      submission,
      product: products.find((product) => product.id === submission.product_id),
    }))
    .filter((item): item is { submission: BloggerSubmissionSummary; product: Product } => Boolean(item.product));

  if (rows.length === 0) {
    return (
      <GlassCard tone="pink" className="p-8">
        <div className="font-hand text-3xl text-[var(--brand-magenta)]">no submitted posts yet</div>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
      {rows.map((row, index) => (
        <button
          key={row.submission.id}
          onClick={() => onOpenProduct(row.product)}
          className={cn("text-left transition", index === 0 ? "" : "opacity-70 grayscale-[0.25]")}
        >
        <GlassCard className="overflow-hidden p-0">
          <img src={row.product.img} alt={row.product.name} className="aspect-square w-full object-cover" />
          <div className="p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {new Date(row.submission.submitted_at).toLocaleDateString()}
            </div>
            <div className="mt-1 font-display text-lg leading-tight">{row.product.name}</div>
            <div className="mt-2 inline-flex rounded-full bg-foreground/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.22em]">
              {statusLabel(row.submission.status)}
            </div>
            {row.submission.review_comment ? (
              <div className="mt-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-xs text-foreground/75">
                Review note: {row.submission.review_comment}
              </div>
            ) : null}
          </div>
        </GlassCard>
        </button>
      ))}
    </div>
  );
}

function GoodiesTab({ resources }: { resources: SharedResource[] }) {
  const links = resources.filter((item) => item.kind === "link");
  const images = resources.filter((item) => item.kind === "image");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("textarea");
      input.value = url;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      input.style.top = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopiedUrl(url);
    window.setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1600);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <GlassCard className="p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
          <span>Useful links</span> ({links.length})
        </div>
        <div className="mt-4 space-y-3">
          {links.map((item) => (
            <div key={item.id} className="rounded-xl border border-foreground/12 bg-background/60 p-4">
              <div className="font-display text-2xl">{item.title}</div>
              {item.description ? <p className="mt-1 text-sm text-foreground/65">{item.description}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                >
                  <span>Open link</span>
                </a>
                <button
                  type="button"
                  onClick={() => void copyLink(item.url)}
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                >
                  {copiedUrl === item.url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedUrl === item.url ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ))}
          {links.length === 0 ? (
            <div className="rounded-xl border border-dashed border-foreground/15 p-6 text-center font-hand text-2xl text-[var(--brand-magenta)]">
              no links yet
            </div>
          ) : null}
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
          <span>Brand textures & files</span> ({images.length})
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {images.map((item) => (
            <div key={item.id} className="rounded-xl border border-foreground/12 bg-background/60 p-3">
              <img src={item.url} alt={item.title} className="aspect-[4/3] w-full rounded-lg object-cover" />
              <div className="mt-2 font-display text-lg">{item.title}</div>
              {item.description ? <p className="text-sm text-foreground/65">{item.description}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={getDownloadUrl(item.url, getDownloadFilename(item.url, item.title))}
                  download={getDownloadFilename(item.url, item.title)}
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
                <a
                  href={item.url}
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                >
                  <span>Open</span>
                </a>
              </div>
            </div>
          ))}
          {images.length === 0 ? (
            <div className="rounded-xl border border-dashed border-foreground/15 p-6 text-center font-hand text-2xl text-[var(--brand-magenta)] sm:col-span-2">
              no files yet
            </div>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}

function getDownloadFilename(url: string, title: string) {
  const safe = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cleanUrl = url.split("?")[0];
  const extFromUrl = cleanUrl.includes(".") ? cleanUrl.split(".").pop() : "png";
  return `${safe || "file"}.${extFromUrl || "png"}`;
}

function getDownloadUrl(url: string, filename: string) {
  try {
    const downloadUrl = new URL(url);
    downloadUrl.searchParams.set("download", filename);
    return downloadUrl.toString();
  } catch {
    return url;
  }
}

type NotificationsTabProps = {
  notifications: AppNotification[];
  unreadCount: number;
  busy: boolean;
  state: "idle" | "saving" | "error";
  onMarkRead: (notificationId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
};

function notificationTypeLabel(type: string | null, language: Lang) {
  const labels: Record<string, { en: string; es: string }> = {
    account_blocked: { en: "Account update", es: "Actualización de cuenta" },
    account_reactivated: { en: "Account reactivated", es: "Cuenta reactivada" },
    deadline_soon: { en: "Deadline soon", es: "Plazo próximo" },
    manual: { en: "HQ note", es: "Nota de HQ" },
    needs_revision: { en: "Needs revision", es: "Necesita revisión" },
    new_message: { en: "New message", es: "Nuevo mensaje" },
    new_product: { en: "New product", es: "Nuevo producto" },
    post_approved: { en: "Post approved", es: "Post aprobado" },
    post_rejected: { en: "Post rejected", es: "Post rechazado" },
  };

  return labels[type ?? "manual"]?.[language] ?? String(type ?? "manual").replace(/_/g, " ");
}

function notificationDisplayTitle(notification: AppNotification, language: Lang) {
  if (language !== "es") return notification.title;
  const title = notification.title.trim();

  if (title === "Love Potion access reactivated") return "Acceso a Love Potion reactivado";
  if (title.startsWith("Post approved:")) return title.replace("Post approved:", "Post aprobado:");
  if (title.startsWith("Post rejected:")) return title.replace("Post rejected:", "Post rechazado:");
  if (title.startsWith("Post needs revision:")) return title.replace("Post needs revision:", "Post necesita revisión:");
  if (title.startsWith("New product:")) return title.replace("New product:", "Nuevo producto:");
  return notification.title;
}

function notificationDisplayBody(notification: AppNotification, language: Lang) {
  if (language !== "es" || !notification.body) return notification.body;
  const body = notification.body.trim();

  if (
    body ===
    "Your blogger account is active again. You can claim products and submit links in the Love Potion dashboard."
  ) {
    return "Tu cuenta de blogger está activa otra vez. Ya puedes reclamar productos y enviar links en el dashboard de Love Potion.";
  }

  return notification.body;
}

function NotificationsTab({
  notifications,
  unreadCount,
  busy,
  state,
  onMarkRead,
  onMarkAllRead,
}: NotificationsTabProps) {
  const language = useLang();
  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            Notification spells
          </div>
          <p className="mt-2 text-sm text-foreground/55">
            {unreadCount > 0
              ? language === "es"
                ? `${unreadCount} señal${unreadCount === 1 ? "" : "es"} sin leer esperando.`
                : `${unreadCount} unread signal${unreadCount === 1 ? "" : "s"} waiting.`
              : "Everything is read and tidy."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state === "error" ? (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700">
              could not update
            </span>
          ) : null}
          {unreadCount > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onMarkAllRead()}
              className="rounded-full bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-background transition hover:bg-[var(--brand-magenta)] disabled:opacity-60"
            >
              {busy ? "saving" : "mark all read"}
            </button>
          ) : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-foreground/15 p-8 text-center">
          <div className="font-hand text-3xl text-[var(--brand-magenta)]">no signals yet</div>
          <p className="mt-2 text-sm text-foreground/55">
            Love Potion HQ has not sent any app notifications.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {notifications.map((notification) => {
            const unread = !notification.read_at;
            const date = notification.created_at ?? notification.sent_at ?? new Date().toISOString();

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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                      unread ? "bg-[var(--brand-magenta)] text-white" : "bg-foreground/5 text-foreground/45",
                    )}
                  >
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45">
                      {notificationTypeLabel(notification.type, language)} · {formatPrettyDate(date, language)}
                    </div>
                    <h3 className="mt-2 font-display text-2xl">{notificationDisplayTitle(notification, language)}</h3>
                    {notificationDisplayBody(notification, language) ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/65">
                        {notificationDisplayBody(notification, language)}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {notification.action_url ? (
                        <a
                          href={notification.action_url}
                          onClick={() => {
                            if (unread) void onMarkRead(notification.id);
                          }}
                          className="rounded-full border border-foreground/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] transition hover:bg-foreground hover:text-background"
                        >
                          open
                        </a>
                      ) : null}
                      {unread ? (
                        <button
                          type="button"
                          disabled={busy}
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

function InboxTab({
  profileId,
  onUnreadChange,
}: {
  profileId: string | null;
  onUnreadChange: (count: number) => void;
}) {
  const language = useLang();
  const [mail, setMail] = useState<InboxMessage[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyState, setReplyState] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({});
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadMail() {
      if (!profileId) return;
      setState("loading");
      setError("");
      try {
        const rows = await listInboxMessages(profileId);
        if (!mounted) return;
        setMail(rows);
        const unreadCount = countPersonalUnread(rows);
        onUnreadChange(unreadCount);
        setState("ready");
        if (unreadCount > 0) {
          try {
            await markPersonalInboxMessagesRead();
            if (!mounted) return;
            const readAt = new Date().toISOString();
            setMail((current) =>
              current.map((message) =>
                message.scope === "personal" && !message.read_at
                  ? { ...message, read_at: readAt }
                  : message,
              ),
            );
            onUnreadChange(0);
          } catch (readError) {
            console.warn("[Blogger Mailbox] could not mark messages read", readError);
          }
        }
      } catch (error) {
        console.error("[Blogger Mailbox] failed to load", error);
        if (!mounted) return;
        setError(error instanceof Error ? error.message : language === "es" ? "No se pudo cargar el buzón." : "Could not load mailbox.");
        setState("error");
      }
    }

    void loadMail();
    return () => {
      mounted = false;
    };
  }, [profileId, onUnreadChange]);

  async function onReply(message: InboxMessage) {
    if (!profileId || !message.sender_id) return;
    const body = replyDrafts[message.id]?.trim();
    if (!body) {
      setReplyErrors((current) => ({ ...current, [message.id]: language === "es" ? "Escribe una respuesta primero." : "Write a reply first." }));
      setReplyState((current) => ({ ...current, [message.id]: "error" }));
      return;
    }

    setReplyErrors((current) => ({ ...current, [message.id]: "" }));
    setReplyState((current) => ({ ...current, [message.id]: "sending" }));
    try {
      await sendInternalReply({
        senderId: profileId,
        recipientId: message.sender_id,
        subject: message.subject.toLowerCase().startsWith("re:")
          ? message.subject
          : `Re: ${message.subject}`,
        body,
      });
      setReplyDrafts((current) => ({ ...current, [message.id]: "" }));
      setReplyState((current) => ({ ...current, [message.id]: "sent" }));
      window.setTimeout(() => {
        setReplyState((current) => ({ ...current, [message.id]: "idle" }));
        setOpenReplyId((current) => (current === message.id ? null : current));
      }, 2600);
    } catch (error) {
      console.error("[Blogger Mailbox] reply failed", error);
      setReplyErrors((current) => ({
        ...current,
        [message.id]: error instanceof Error ? error.message : "Could not send reply.",
      }));
      setReplyState((current) => ({ ...current, [message.id]: "error" }));
    }
  }

  if (state === "loading") {
    return (
      <GlassCard className="p-8 text-center font-hand text-2xl text-[var(--brand-magenta)]">
        opening mailbox...
      </GlassCard>
    );
  }

  if (state === "error") {
    return (
      <GlassCard className="p-8 text-center text-sm text-[var(--brand-magenta)]">
        {error}
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-4">
      {mail.map((message) => {
        const replyOpen = openReplyId === message.id;
        const canReply = message.scope === "personal" && Boolean(message.sender_id);

        return (
        <GlassCard key={message.id} className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                {message.scope === "broadcast" ? (language === "es" ? "GENERAL" : "BROADCAST") : language === "es" ? "PERSONAL" : "PERSONAL"} ·{" "}
                {message.sender_name || "Love Potion HQ"}
              </div>
              <div className="mt-2 font-display text-2xl">{message.subject}</div>
            </div>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              {new Date(message.created_at).toLocaleDateString()}
            </span>
          </div>
          {message.body ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">
              {message.body}
            </p>
          ) : null}
          {canReply ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setOpenReplyId((current) => (current === message.id ? null : message.id))}
                className={cn(
                  "rounded-full px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] transition",
                  replyOpen
                    ? "bg-foreground text-background"
                    : "bg-[var(--brand-magenta)] text-white shadow-[0_12px_30px_rgba(219,24,97,0.20)] hover:bg-foreground",
                )}
              >
                {replyOpen ? "Close reply" : "Reply"}
              </button>
              {replyState[message.id] === "sent" || replyState[message.id] === "error" ? (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    replyState[message.id] === "sent"
                      ? "bg-green-100 text-green-700"
                      : "bg-rose-100 text-rose-700",
                  )}
                >
                  {replyState[message.id] === "sent"
                    ? "Reply sent."
                    : replyErrors[message.id] || "Could not send reply."}
                </span>
              ) : null}
            </div>
          ) : null}
          {canReply && replyOpen ? (
            <div className="mt-5 rounded-2xl border border-foreground/10 bg-background/60 p-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/50">
                <span>Reply to</span> {message.sender_name || "Love Potion HQ"}
              </div>
              <textarea
                value={replyDrafts[message.id] ?? ""}
                onChange={(event) =>
                  setReplyDrafts((current) => ({ ...current, [message.id]: event.target.value }))
                }
                rows={3}
                placeholder="Write back to Love Potion HQ..."
                className="mt-3 w-full resize-none rounded-2xl border border-foreground/20 bg-background px-4 py-3 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  onClick={() => void onReply(message)}
                  disabled={replyState[message.id] === "sending"}
                  className="rounded-full bg-foreground px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:opacity-60"
                >
                  {replyState[message.id] === "sending" ? "Sending..." : "Reply →"}
                </button>
              </div>
            </div>
          ) : null}
        </GlassCard>
        );
      })}
      {mail.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <div className="font-hand text-3xl text-[var(--brand-magenta)]">no messages yet</div>
          <p className="mt-2 text-sm text-foreground/55">Love Potion HQ has not sent anything here.</p>
        </GlassCard>
      ) : null}
    </div>
  );
}

function LinksTab({
  products,
  onOpenProduct,
  submissionByProduct,
}: {
  products: Product[];
  onOpenProduct: (product: Product) => void;
  submissionByProduct: Record<string, BloggerSubmissionSummary>;
}) {
  return (
    <div className="grid gap-5">
      <GlassCard tone="pink" className="p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
          SUBMIT YOUR POST
        </div>
        <h3 className="mt-2 font-display text-3xl">Choose the product first.</h3>
        <p className="mt-2 max-w-2xl text-sm text-foreground/70">
          Cada envio fica preso ao produto certo, com deadline, localização, poster oficial e
          instruções da loja no mesmo modal.
        </p>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        {products.slice(0, 4).map((product) => {
          const submission = submissionByProduct[product.id];
          const submitted = Boolean(submission);
          return (
            <GlassCard
              key={product.id}
              className="grid gap-4 p-4 sm:grid-cols-[110px_1fr_auto] sm:items-center"
            >
              <img
                src={product.img}
                alt={product.name}
                className="aspect-[4/5] w-full rounded-xl object-cover sm:w-[110px]"
              />
          <div>
            <div className="font-display text-2xl">{product.name}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/50">
              <span>Deadline</span> · {product.deadline}
            </div>
                {submitted && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-green-700">
                    <Check className="h-3 w-3" />
                    {statusLabel(submission.status)}
                  </div>
                )}
              </div>
              <button
                onClick={() => onOpenProduct(product)}
                className="rounded-full bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-background hover:bg-[var(--brand-magenta)]"
              >
                Send links
              </button>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function ProductSubmissionModal({
  product,
  submission,
  submissionHistory,
  claim,
  profileId,
  accountLocked,
  accountStatus,
  onClose,
  onClaim,
  onSubmit,
}: {
  product: Product;
  submission?: BloggerSubmissionSummary;
  submissionHistory: BloggerSubmissionSummary[];
  claim?: BloggerProductClaimSummary;
  profileId: string | null;
  accountLocked: boolean;
  accountStatus: string;
  onClose: () => void;
  onClaim: (claim: BloggerProductClaimSummary) => void;
  onSubmit: (submission: BloggerSubmissionSummary) => void;
}) {
  const language = useLang();
  const [links, setLinks] = useState<PortfolioLink[]>([
    { id: 1, platform: "Flickr", url: "", note: "" },
  ]);
  const [copied, setCopied] = useState(false);
  const [bloggerNote, setBloggerNote] = useState("");
  const [promotionConsent, setPromotionConsent] = useState(submission?.promotion_consent ?? false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [claimState, setClaimState] = useState<ProductClaimState>(getProductClaimState(claim, submission));
  const [latestReviewerNote, setLatestReviewerNote] = useState<string | null>(
    submissionHistory.find((row) => Boolean(row.review_comment?.trim()))?.review_comment ?? null,
  );
  const [latestReviewer, setLatestReviewer] = useState<SubmissionCommentProfile | null>(null);
  const canSubmit = links.some((link) => link.url.trim().length > 0);
  const hasClaimRecord =
    claimState === "claimed" ||
    claimState === "delivered" ||
    claimState === "failed" ||
    Boolean(submission) ||
    Boolean(claim);
  const isDelivered = claimState === "delivered" || Boolean(submission) || claim?.status === "delivered";
  const accountLockMessage =
    accountStatus === "blocked"
      ? "Your account is paused by the monthly rule. Love Potion HQ needs to reactivate it before you can claim products or submit links."
      : accountStatus === "pending"
        ? "Your account is waiting for approval. Claims and submissions unlock when Love Potion HQ activates your profile."
        : accountStatus === "left"
          ? "You left the blogger program. Claims and submissions are closed unless Love Potion HQ reactivates your profile."
        : "";
  const lockedClaimLabel =
    accountStatus === "blocked" ? "Account paused" : accountStatus === "left" ? "Program left" : "Awaiting approval";
  const lockedSubmitLabel =
    accountStatus === "blocked" ? "Reactivate first" : accountStatus === "left" ? "Program left" : "Approval needed";

  useEffect(() => {
    setClaimState(getProductClaimState(claim, submission));
  }, [claim?.id, product.id, submission?.id]);

  useEffect(() => {
    let mounted = true;
    async function loadExistingSubmissionData() {
      if (!profileId) return;
      setLoadingExisting(true);
      try {
        const payload = await getLatestSubmissionForProduct(profileId, product.id);
        if (!mounted || !payload) return;

        setLatestReviewerNote(payload.latestReviewNote);
        setLatestReviewer(payload.latestReviewer);
        if (payload.latest.blogger_note) setBloggerNote(payload.latest.blogger_note);
        setPromotionConsent(payload.latest.promotion_consent);
        setClaimState("delivered");

        if (payload.links.length > 0) {
          setLinks(
            payload.links.map((link, index) => ({
              id: Number(link.id.replace(/-/g, "").slice(0, 12)) || Date.now() + index,
              platform: link.platform,
              url: link.url,
              note: link.note ?? "",
            })),
          );
        }
      } catch (error) {
        if (!mounted) return;
        console.error("[Blogger] Could not load existing submission data", error);
      } finally {
        if (mounted) setLoadingExisting(false);
      }
    }
    void loadExistingSubmissionData();
    return () => {
      mounted = false;
    };
  }, [profileId, product.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const normalizeUrl = (value: string) => {
    const raw = value.trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  };

  const isValidUrl = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const updateLink = (id: number, patch: Partial<PortfolioLink>) => {
    setLinks((current) => current.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  };

  const addLink = () => {
    setLinks((current) => [
      ...current,
      {
        id: Date.now(),
        platform: "Blog",
        url: "",
        note: "",
      },
    ]);
  };

  const removeLink = (id: number) => {
    setLinks((current) =>
      current.length === 1 ? current : current.filter((link) => link.id !== id),
    );
  };

  const copyLocation = async () => {
    await navigator.clipboard?.writeText(product.location);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadPoster = () => {
    if (!product.vendorPoster) return;
    const anchor = document.createElement("a");
    anchor.href = product.vendorPoster;
    anchor.download = `${product.name.replace(/\s+/g, "-").toLowerCase()}-vendor-poster.jpg`;
    anchor.click();
  };

  const submitPortfolio = async () => {
    if (!profileId || !canSubmit || status === "saving") return;
    if (accountLocked) {
      setStatus("error");
      setMessage(accountLockMessage || "Your account cannot submit links right now.");
      return;
    }
    if (!isDelivered) {
      setStatus("error");
      setMessage("Claim and receive this product first, then submit your portfolio links.");
      return;
    }
    setStatus("saving");
    setMessage("");

    try {
      const normalizedLinks = links
        .map((link, index) => ({
          platform: link.platform,
          url: normalizeUrl(link.url),
          note: link.note.trim() || null,
          sort_order: index,
        }))
        .filter((link) => link.url.length > 0);

      const invalid = normalizedLinks.find((link) => !isValidUrl(link.url));
      if (invalid) {
        setStatus("error");
        setMessage(`${language === "es" ? "URL inválida" : "Invalid URL"}: ${invalid.url}`);
        return;
      }

      const saved = await submitLinksForProduct({
        productId: product.id,
        bloggerId: profileId,
        bloggerNote: bloggerNote.trim() || null,
        promotionConsent,
        links: normalizedLinks,
      });

      setStatus("success");
      setMessage("Portfolio submitted. Your links were sent for review.");
      void notifyStaffSecondLifeQuietly({
        type: "manual",
        title: `New post to review: ${product.name}`,
        body: `${profile?.display_name ?? profile?.full_name ?? profile?.email ?? "A blogger"} submitted ${normalizedLinks.length} link${normalizedLinks.length === 1 ? "" : "s"} for ${product.name}.`,
        actionUrl: "/app/atelier",
      });
      onSubmit({
        id: saved.id,
        product_id: saved.product_id,
        status: saved.status,
        submitted_at: saved.submitted_at,
        review_comment: saved.review_comment,
        promotion_consent: promotionConsent,
        links_count: normalizedLinks.length,
      });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not submit links.");
      return;
    }
  };

  const claimProduct = async () => {
    if (!profileId || claimState === "claiming" || claimState === "delivered") return;
    if (accountLocked) {
      setClaimState("error");
      setMessage(accountLockMessage || "Your account cannot claim products right now.");
      return;
    }
    if (!isUuid(product.id)) {
      setClaimState("error");
      setMessage("This product is in mock mode right now. Refresh and try again in live mode.");
      return;
    }
    setClaimState("claiming");
    setMessage("");
    try {
      const claim = await claimProductForBlogger(product.id, profileId);
      setClaimState(getProductClaimState(claim));
      onClaim({
        id: claim.id,
        product_id: claim.product_id,
        status: claim.status,
        claimed_at: claim.claimed_at,
        delivered_at: claim.delivered_at,
      });
      setMessage(
        claim.deliveryNotice ??
          (claim.status === "delivered"
            ? "Product delivered in Second Life. You can now submit your links."
            : "Claim saved. Second Life delivery is still pending, so try delivery again before submitting links."),
      );
    } catch (error) {
      setClaimState("error");
      setMessage(error instanceof Error ? error.message : "Could not claim this product.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/45 p-4 backdrop-blur-md md:p-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-white/40 bg-background/95 shadow-2xl md:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-foreground/10 p-5 md:border-b-0 md:border-r">
          <img
            src={product.img}
            alt={product.name}
            className="aspect-[4/5] w-full rounded-3xl object-cover shadow-xl"
          />

          <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            Release dossier
          </div>
          <h2 className="mt-2 font-display text-4xl leading-none">{product.name}</h2>

          <div className="mt-6 rounded-2xl bg-[var(--brand-magenta)]/10 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              Deadline
            </div>
            <div className="mt-1 flex items-end justify-between gap-4">
              <span className="font-display text-2xl">{product.deadline}</span>
              {submission ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  Submitted
                </span>
              ) : (
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
                  {product.expires}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              Location
            </div>
            <button
              onClick={copyLocation}
              className="mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/15 bg-white/60 px-4 py-3 text-left text-sm text-foreground/70 hover:border-[var(--brand-magenta)]"
            >
              <span className="truncate">{product.location}</span>
              {copied ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <Copy className="h-4 w-4 shrink-0" />
              )}
            </button>
          </div>

          <button
            onClick={downloadPoster}
            disabled={!product.vendorPoster}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-foreground/25 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-foreground hover:text-background"
          >
            <Download className="h-4 w-4" />
            {product.vendorPoster ? "Download vendor poster" : "Vendor poster unavailable"}
          </button>
        </div>

        <div className="relative p-5 md:p-8">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full bg-foreground/5 p-3 hover:bg-foreground hover:text-background"
            aria-label="Close product dossier"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="pr-14">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              Recommendations
            </div>
            <p className="mt-3 max-w-2xl text-xl italic leading-relaxed text-foreground/75">
              {product.recommendation}
            </p>
            {submission ? (
              <div className="mt-3 inline-flex rounded-full bg-foreground/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]">
                <span>Current status</span> · {statusLabel(submission.status)}
              </div>
            ) : null}
            {accountLocked ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {accountLockMessage}
              </div>
            ) : null}
            {latestReviewerNote ? (
              <ProductCommentBubble label="Love Potion note" profile={latestReviewer}>
                {latestReviewerNote}
              </ProductCommentBubble>
            ) : null}
            {!latestReviewerNote && loadingExisting ? (
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/50">
                loading latest review note...
              </div>
            ) : null}
          </div>

          <div className="mt-8 border-t border-foreground/10 pt-8">
            <div className="flex items-center justify-between gap-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                Submit your magic
              </div>
              <span className="rounded-full bg-foreground px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-background">
                {links.length} <span>links</span>
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {links.map((link) => (
                <div key={link.id} className="rounded-2xl bg-foreground/[0.04] p-4">
                  <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
                    <select
                      value={link.platform}
                      onChange={(event) => updateLink(link.id, { platform: event.target.value })}
                      className="rounded-xl border border-foreground/10 bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none focus:border-[var(--brand-magenta)]"
                    >
                      <option>Flickr</option>
                      <option>Blog</option>
                      <option>Instagram</option>
                      <option>Facebook</option>
                      <option>Primfeed</option>
                      <option>Other</option>
                    </select>
                    <input
                      value={link.url}
                      onChange={(event) => updateLink(link.id, { url: event.target.value })}
                      placeholder="https://..."
                      className="rounded-xl border border-foreground/10 bg-background px-4 py-3 outline-none focus:border-[var(--brand-magenta)]"
                    />
                    <button
                      onClick={() => removeLink(link.id)}
                      className="rounded-xl px-3 text-[var(--brand-magenta)] hover:bg-[var(--brand-magenta)]/10 disabled:opacity-30"
                      disabled={links.length === 1}
                      aria-label="Remove link"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-foreground/10 bg-white/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/50">
                Message attached to this submission
                </div>
                <span className="rounded-full bg-[var(--brand-pink)] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-[var(--brand-magenta)]">
                  sent with portfolio
                </span>
              </div>
              <textarea
                value={bloggerNote}
                onChange={(event) => setBloggerNote(event.target.value)}
                rows={2}
                placeholder="Optional note for Love Potion HQ..."
                className="mt-3 w-full rounded-xl border border-foreground/10 bg-background/70 px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)]"
              />
              <p className="mt-2 text-xs text-foreground/45">
                This note is sent together with your links when you press Submit portfolio.
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/50 bg-white/55 p-4 shadow-sm transition hover:border-[var(--brand-magenta)]/40 hover:bg-white/70">
              <input
                type="checkbox"
                checked={promotionConsent}
                onChange={(event) => setPromotionConsent(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-foreground/20 accent-[var(--brand-magenta)]"
              />
              <span className="text-sm leading-relaxed text-foreground/70">
                <span className="block font-medium text-foreground">
                  {language === "es"
                    ? "Permito que Love Potion use mis imágenes o vistas previas enviadas como material promocional."
                    : "I allow Love Potion to use my submitted images or post previews as promotional material."}
                </span>
                <span className="mt-1 block text-xs text-foreground/45">
                  {language === "es"
                    ? "Tus links siguen acreditados a ti."
                    : "Your links stay credited to you."}
                </span>
              </span>
            </label>

            {message ? (
              <div
                className={cn(
                  "mt-4 rounded-xl px-4 py-3 text-sm",
	                  status === "error" || claimState === "error"
	                    ? "border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/45 text-[var(--brand-magenta)]"
	                    : claimState === "failed"
	                      ? "border border-rose-200 bg-rose-50 text-rose-700"
	                    : claimState === "claimed"
	                      ? "border border-amber-200 bg-amber-50 text-amber-700"
                    : "border border-green-200 bg-green-50 text-green-700",
                )}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={claimProduct}
                disabled={!profileId || accountLocked || claimState === "claiming" || claimState === "delivered"}
                title={accountLocked ? accountLockMessage : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] transition disabled:cursor-not-allowed",
	                  claimState === "delivered"
	                    ? "border border-foreground/10 bg-foreground/10 text-foreground/45"
	                    : claimState === "failed"
	                      ? "border border-[var(--brand-magenta)] bg-[var(--brand-pink)]/60 text-[var(--brand-magenta)] shadow-lg shadow-[var(--brand-pink)]/40 hover:bg-[var(--brand-magenta)] hover:text-white"
	                    : claimState === "claimed"
	                      ? "border border-amber-200 bg-amber-50 text-amber-700 shadow-lg shadow-amber-100 hover:border-[var(--brand-magenta)] hover:bg-[var(--brand-magenta)] hover:text-white"
                      : "border border-[var(--brand-magenta)] bg-[var(--brand-magenta)] text-white shadow-lg shadow-[var(--brand-magenta)]/20 hover:border-foreground hover:bg-foreground",
                  accountLocked ? "border-foreground/15 bg-foreground/10 text-foreground/40 shadow-none" : "",
                  claimState === "claiming" ? "opacity-80" : "",
                )}
              >
                {accountLocked
                  ? lockedClaimLabel
                  : claimState === "claiming"
                    ? "Claiming..."
	                    : claimState === "delivered"
	                      ? "Claimed"
	                      : claimState === "failed"
	                        ? "Retry delivery"
	                      : claimState === "claimed"
	                        ? "Retry delivery"
                      : "Claim product"}
              </button>
              <button
                onClick={addLink}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-foreground/25 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]"
              >
                <Plus className="h-4 w-4" />
                Add another link
              </button>
              <button
                onClick={submitPortfolio}
                disabled={!canSubmit || !profileId || accountLocked || status === "saving" || !isDelivered}
                title={accountLocked ? accountLockMessage : !isDelivered ? "Claim and receive the product before submitting links." : undefined}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {accountLocked ? lockedSubmitLabel : status === "saving" ? "Submitting..." : "Submit portfolio"}
              </button>
            </div>
            {!hasClaimRecord ? (
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/55">
                Step 1: claim product · Step 2: submit links
              </p>
	    ) : !isDelivered ? (
	      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700">
	        {claimState === "failed"
	          ? "Delivery failed · retry delivery before submitting links"
	          : "Delivery pending · retry delivery before submitting links"}
	      </p>
	    ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function BloggerVirtualTour({ onDone }: { onDone: () => void }) {
  const language = useLang();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const tourSteps = [
    {
      number: "01",
      key: "products",
      target: language === "es" ? "Productos" : "Products",
      direction: language === "es" ? "Empieza aquí" : "Go here first",
      title: language === "es" ? "Elige lo que quieres bloguear." : "Choose what you want to blog.",
      body:
        language === "es"
          ? "Abre un lanzamiento, reclama el producto y vuelve al mismo lugar después para enviar los links de tu post."
          : "Open a release, claim the product, and use the same place later to submit your post links.",
    },
    {
      number: "02",
      key: "posts",
      target: "Posts",
      direction: language === "es" ? "Revisa tu trabajo" : "Check your work",
      title: language === "es" ? "Mira lo que ya enviaste." : "See what you already sent.",
      body:
        language === "es"
          ? "Los posts aprobados, pendientes, rechazados o que necesitan revisión viven aquí para que tu historial sea fácil de revisar."
          : "Approved, pending, rejected, and revision-needed posts live here so your history stays easy to scan.",
    },
    {
      number: "03",
      key: "goodies",
      target: language === "es" ? "Bolsa de regalos" : "Bag of goodies",
      direction: language === "es" ? "Toma extras" : "Grab extras",
      title: language === "es" ? "Descarga materiales de marca." : "Download brand materials.",
      body:
        language === "es"
          ? "Logos, texturas, links y recursos compartidos por Love Potion HQ están reunidos en este cajón."
          : "Logos, textures, links, and shared resources from Love Potion HQ are collected in this drawer.",
    },
    {
      number: "04",
      key: "notifications",
      target: language === "es" ? "Notificaciones" : "Notifications",
      direction: language === "es" ? "Mira las señales" : "Watch the signals",
      title: language === "es" ? "Lee avisos oficiales." : "Read official updates.",
      body:
        language === "es"
          ? "Avisos importantes de cuenta, alertas de productos, recordatorios y mensajes de entrega aparecen aquí."
          : "Important account notices, product alerts, reminders, and delivery messages appear here.",
    },
    {
      number: "05",
      key: "inbox",
      target: language === "es" ? "Buzón" : "Mailbox",
      direction: language === "es" ? "Habla con HQ" : "Talk to HQ",
      title: language === "es" ? "Abre mensajes privados." : "Open private messages.",
      body:
        language === "es"
          ? "Usa esto para conversaciones directas con el equipo de Love Potion sin mezclarlas con avisos generales."
          : "Use this for direct conversations with the Love Potion team without mixing them with general notices.",
    },
    {
      number: "06",
      key: "profile",
      target: language === "es" ? "Perfil" : "Profile",
      direction: language === "es" ? "Mantén todo al día" : "Keep it current",
      title: language === "es" ? "Actualiza tu identidad." : "Update your identity.",
      body:
        language === "es"
          ? "El UUID del avatar, links sociales, contraseña, disponibilidad y la opción de salir del programa se gestionan aquí."
          : "Avatar UUID, social links, password, availability, and the leave-program option are managed there.",
    },
  ];
  const currentStep = tourSteps[stepIndex];
  const previousStep = () => setStepIndex((current) => Math.max(0, current - 1));
  const nextStep = () => setStepIndex((current) => Math.min(tourSteps.length - 1, current + 1));

  useEffect(() => {
    function updateTargetRect() {
      const target = document.querySelector(`[data-blogger-tour="${currentStep.key}"]`);
      if (!(target instanceof HTMLElement)) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }

    updateTargetRect();
    const animation = window.requestAnimationFrame(updateTargetRect);
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      window.cancelAnimationFrame(animation);
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [currentStep.key]);

  const popoverTop = targetRect
    ? Math.min(
        Math.max(targetRect.top + targetRect.height / 2 - 122, 96),
        Math.max((typeof window === "undefined" ? 720 : window.innerHeight) - 300, 96),
      )
    : 120;
  const popoverLeft = targetRect ? targetRect.left + targetRect.width + 72 : 360;

  return (
    <>
      {targetRect ? (
        <>
          <div
            className="pointer-events-none fixed z-40 hidden rounded-xl border-2 border-[var(--brand-magenta)] bg-[var(--brand-pink)]/20 shadow-[0_0_0_9999px_rgba(43,18,44,0.10),0_18px_45px_rgba(219,24,97,0.24)] md:block"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
          />
          <div
            className="pointer-events-none fixed z-40 hidden items-center md:flex"
            style={{
              top: targetRect.top + targetRect.height / 2 - 8,
              left: targetRect.left + targetRect.width + 10,
            }}
          >
            <div className="h-px w-14 bg-[var(--brand-magenta)]" />
            <ArrowRight className="h-5 w-5 text-[var(--brand-magenta)]" />
          </div>
          <GlassCard
            tone="pink"
            className="tour-soft-bounce fixed z-50 hidden w-[360px] p-5 shadow-2xl shadow-[var(--brand-magenta)]/20 md:block"
            style={{
              top: popoverTop,
              left: popoverLeft,
            }}
          >
            <VirtualTourCard
              currentStep={currentStep}
              isFirst={stepIndex === 0}
              isLast={stepIndex === tourSteps.length - 1}
              onDone={onDone}
              onNext={nextStep}
              onPrevious={previousStep}
              progress={`${stepIndex + 1} / ${tourSteps.length}`}
              language={language}
            />
          </GlassCard>
        </>
      ) : null}

      <div className="fixed inset-x-4 bottom-5 z-50 md:hidden">
        <GlassCard tone="pink" className="tour-soft-bounce p-5 shadow-2xl shadow-[var(--brand-magenta)]/20">
          <VirtualTourCard
            currentStep={currentStep}
            isFirst={stepIndex === 0}
            isLast={stepIndex === tourSteps.length - 1}
            onDone={onDone}
            onNext={nextStep}
            onPrevious={previousStep}
            progress={`${stepIndex + 1} / ${tourSteps.length}`}
            language={language}
          />
        </GlassCard>
      </div>
    </>
  );
}

function VirtualTourCard({
  currentStep,
  isFirst,
  isLast,
  language,
  onDone,
  onNext,
  onPrevious,
  progress,
}: {
  currentStep: {
    number: string;
    target: string;
    direction: string;
    title: string;
    body: string;
  };
  isFirst: boolean;
  isLast: boolean;
  language: Lang;
  onDone: () => void;
  onNext: () => void;
  onPrevious: () => void;
  progress: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onDone}
        className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/65 text-lg leading-none text-[var(--brand-magenta)] shadow-sm transition hover:bg-[var(--brand-magenta)] hover:text-white"
        aria-label="Close tour"
      >
        ×
      </button>
      <div className="flex items-center justify-between gap-3 pr-9">
        <span className="rounded-full bg-[var(--brand-magenta)] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.25em] text-white">
          {currentStep.target}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/45">{progress}</span>
      </div>
      <div className="mt-4 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
        <ArrowRight className="h-4 w-4" />
        {currentStep.direction}
      </div>
      <h3 className="mt-3 font-display text-3xl leading-none text-[var(--ink)]">{currentStep.title}</h3>
      <p className="mt-3 text-sm leading-7 text-foreground/65">{currentStep.body}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isFirst}
          className="rounded-full border border-foreground/15 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/60 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {language === "es" ? "Atrás" : "Back"}
        </button>
        <button
          type="button"
          onClick={isLast ? onDone : onNext}
          className="rounded-full bg-foreground px-5 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {isLast ? (language === "es" ? "Listo" : "Done") : language === "es" ? "Siguiente" : "Next"}
        </button>
      </div>
    </div>
  );
}

function LeftProgramSuccess({ language }: { language: "en" | "es" }) {
  const [isExiting, setIsExiting] = useState(false);

  async function exitAccount() {
    setIsExiting(true);
    try {
      await signOut();
    } finally {
      window.location.replace(`/${language}/login`);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-5rem)] place-items-center px-6 py-12">
      <GlassCard tone="pink" className="max-w-2xl p-8 text-center md:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--brand-magenta)] text-3xl text-white shadow-xl shadow-[var(--brand-magenta)]/25">
          <Check className="h-8 w-8" />
        </div>
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
          Love Potion · blogger program
        </div>
        <h1 className="mt-4 font-display text-4xl leading-none text-[var(--ink)] md:text-6xl">
          Voce deixou a loja Love Potion com sucesso!
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-foreground/65">
          Seu historico continua salvo para a equipe, e a Love Potion HQ foi avisada. Voce pode fechar esta pagina ou sair da conta agora.
        </p>
        <button
          type="button"
          onClick={() => void exitAccount()}
          disabled={isExiting}
          className="mt-8 rounded-full bg-foreground px-7 py-3 font-mono text-[10px] uppercase tracking-[0.28em] text-background shadow-lg shadow-foreground/10 transition hover:bg-[var(--brand-magenta)] disabled:cursor-wait disabled:opacity-60"
        >
          {isExiting ? "Saindo..." : "Sair da conta"}
        </button>
      </GlassCard>
    </div>
  );
}

/* ───────── Profile editor ───────── */

const NOTE_MAX = 60;

function ProfileTab(props: {
  photo: string;
  setPhoto: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  status: Status;
  setStatus: (v: Status) => void;
  profile: AuthProfile | null;
  onLeftProgram: (profile: AuthProfile) => void;
  onProfileUpdated: (profile: AuthProfile) => void;
}) {
  const { photo, setPhoto, note, setNote, status, setStatus, profile, onLeftProgram, onProfileUpdated } = props;
  const uiLanguage = useLang();
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveState, setLeaveState] = useState<"idle" | "confirming" | "leaving" | "left" | "error">("idle");
  const [leaveMessage, setLeaveMessage] = useState("");

  const slAvatar = profile?.sl_avatar_name || profile?.full_name || profile?.display_name || "";
  const email = profile?.email || "";

  useEffect(() => {
    setDisplayName(profile?.display_name || profile?.full_name || "");
    setLanguage(profile?.language_preference || "en");
  }, [profile?.display_name, profile?.full_name, profile?.language_preference]);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    const url = URL.createObjectURL(f);
    setPhoto(url);
  };

  const onNoteChange = (v: string) => {
    // Limit to 2 lines, NOTE_MAX chars
    const lines = v.split("\n").slice(0, 2);
    const trimmed = lines.join("\n").slice(0, NOTE_MAX);
    setNote(trimmed);
  };

  async function uploadAvatarIfNeeded() {
    if (!photoFile || !profile?.id) return null;
    const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${profile.id}/${Date.now()}-avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(filePath, photoFile, {
      upsert: true,
      contentType: photoFile.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function onSaveProfile() {
    if (!profile?.id) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      const uploadedAvatar = await uploadAvatarIfNeeded();
      const existingAvatar = profile.avatar_url?.startsWith("blob:") ? null : profile.avatar_url;
      const updated = await updateCurrentProfile({
        display_name: displayName.trim() || null,
        status_message: note.trim() || null,
        availability_status: mapStatusToAvailability(status),
        language_preference: language,
        avatar_url: uploadedAvatar ?? existingAvatar,
      });
      onProfileUpdated(updated);
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: updated }));
      setPhoto(getSafeAvatarUrl(updated.avatar_url));
      setPhotoFile(null);
      setSaveMessage("Profile saved.");
      window.setTimeout(() => setSaveMessage(""), 2600);
    } catch (error) {
      console.error("[Blogger Profile] save failed", error);
      setSaveMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onUpdatePassword() {
    setPasswordMessage("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("Fill in all password fields.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage("New password must have at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New password and confirmation do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateCurrentPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
      window.setTimeout(() => setPasswordMessage(""), 2600);
    } catch (error) {
      console.error("[Blogger Profile] password update failed", error);
      setPasswordMessage(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  async function onLeaveProgram() {
    setLeaveMessage("");

    if (leaveState === "idle") {
      setLeaveState("confirming");
      setLeaveMessage(
        uiLanguage === "es"
          ? "Haz clic en Salir del programa otra vez para confirmar. Tu historial queda guardado para el equipo."
          : "Click Leave Program again to confirm. Your history stays saved for the team.",
      );
      return;
    }

    if (leaveState !== "confirming") return;

    setLeaveState("leaving");
    try {
      const updated = await leaveBloggerProgram(leaveReason);
      onProfileUpdated(updated);
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: updated }));
      setStatus("offline");
      setLeaveState("left");
      setLeaveMessage(
        uiLanguage === "es"
          ? "Saliste del programa de bloggers. El equipo de Love Potion fue avisado."
          : "You have left the blogger program. The Love Potion team has been notified.",
      );
      onLeftProgram(updated);
    } catch (error) {
      console.error("[Blogger Profile] leave program failed", error);
      setLeaveState("error");
      setLeaveMessage(error instanceof Error ? error.message : "Could not leave the blogger program.");
    }
  }

  const statuses: { id: Status; label: string; help: string }[] = [
    { id: "active", label: "Active", help: "Posting as usual" },
    { id: "vacation", label: "On vacation", help: "Pause monthly rule" },
    { id: "busy", label: "Busy", help: "Reduced activity" },
    { id: "offline", label: "Offline", help: "Temporarily unavailable" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Live preview */}
      <GlassCard className="md:col-span-4 overflow-hidden p-0">
        <AvatarCard photo={photo} note={note} status={status} />
        <div className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            LIVE PREVIEW
          </div>
          <div className="mt-1 font-display text-2xl">{displayName || "—"}</div>
          <p className="mt-1 text-sm text-foreground/70">This is how others see you.</p>
        </div>
      </GlassCard>

      {/* Editor */}
      <div className="md:col-span-8 grid gap-6">
        {/* Identity + photo */}
        <GlassCard tone="pink" className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
            IDENTITY
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Display name" value={displayName} onChange={setDisplayName} />
            <Field label="SL avatar" value={slAvatar} disabled />
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                Language
              </span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "es")}
                className="mt-1 w-full rounded-full border border-foreground/20 bg-background/70 px-4 py-2 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
              </select>
            </label>
            <Field label="Email" value={email} disabled />
          </div>
          <div className="mt-6 flex items-center gap-4">
            <img
              src={photo}
              alt="avatar"
              className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--brand-magenta)]/50"
            />
            <label className="cursor-pointer rounded-full border border-foreground/30 bg-background/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]">
              Change photo
              <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
            </label>
          </div>
        </GlassCard>

        {/* Overlay note */}
        <GlassCard className="p-6">
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              CUSTOM NOTE
              </div>
              <span className="font-mono text-[10px] text-foreground/50">
                {note.length}/{NOTE_MAX} · <span>max 2 lines</span>
              </span>
            </div>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="e.g. on a velvet night ♡"
            rows={2}
            maxLength={NOTE_MAX}
            className="mt-3 w-full resize-none rounded-2xl border border-foreground/20 bg-background/70 px-5 py-3 font-display text-xl leading-tight focus:border-[var(--brand-magenta)] focus:outline-none"
          />
          <p className="mt-2 font-hand text-base text-[var(--brand-magenta)]">
            shown over your avatar, like instagram notes
          </p>
        </GlassCard>

        {/* Status */}
        <GlassCard className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            STATUS
          </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {statuses.map((s) => {
              const active = status === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStatus(s.id)}
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition",
                    active
                      ? "border-[var(--brand-magenta)] bg-[var(--brand-magenta)]/10"
                      : "border-foreground/20 hover:border-foreground/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", STATUS_COLOR[s.id])} />
                    <span className="font-display text-lg">{s.label}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                    {s.help}
                  </div>
                </button>
              );
            })}
            </div>
          </GlassCard>

        {/* Password */}
        <GlassCard className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            PASSWORD
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field
              label="Current"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <Field
              label="New"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
            />
            <Field
              label="Confirm new"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
          </div>
          <div className="mt-5 flex items-center justify-end gap-3">
            {passwordMessage ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  passwordMessage === "Password updated."
                    ? "bg-green-100 text-green-700"
                    : "bg-rose-100 text-rose-700",
                )}
              >
                {passwordMessage}
              </span>
            ) : null}
            <button
              onClick={() => void onUpdatePassword()}
              disabled={isUpdatingPassword}
              className="rounded-full bg-foreground px-6 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:opacity-60"
            >
              {isUpdatingPassword ? "Updating..." : "Update password"}
            </button>
          </div>
        </GlassCard>

        <GlassCard className="border-[var(--brand-magenta)]/25 bg-[var(--brand-pink)]/35 p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            DANGER ZONE
          </div>
          <h3 className="mt-2 font-display text-3xl leading-none">Leave blogger program.</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/65">
            This marks your account as left and removes you from the active blogger program.
          </p>
          <textarea
            value={leaveReason}
            onChange={(event) => setLeaveReason(event.target.value)}
            rows={2}
            placeholder="Optional note for Love Potion HQ"
            disabled={leaveState === "leaving" || leaveState === "left"}
            className="mt-4 w-full resize-none rounded-2xl border border-[var(--brand-magenta)]/20 bg-background/70 px-5 py-3 text-sm outline-none focus:border-[var(--brand-magenta)] disabled:opacity-60"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {leaveMessage ? (
              <span
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm",
                  leaveState === "left"
                    ? "bg-green-100 text-green-700"
                    : leaveState === "error"
                      ? "bg-red-100 text-red-700"
                      : "bg-white/60 text-[var(--brand-magenta)]",
                )}
              >
                {leaveMessage}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void onLeaveProgram()}
              disabled={leaveState === "leaving" || leaveState === "left" || profile?.account_status === "left"}
              className="rounded-full bg-[var(--brand-magenta)] px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white shadow-lg shadow-[var(--brand-magenta)]/20 hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {leaveState === "leaving"
                ? "Leaving..."
                : leaveState === "confirming"
                  ? "Confirm leave program"
                  : profile?.account_status === "left" || leaveState === "left"
                    ? "Program left"
                    : "Leave program"}
            </button>
          </div>
        </GlassCard>

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3">
          {saveMessage ? (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                saveMessage === "Profile saved." ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700",
              )}
            >
              {saveMessage}
            </span>
          ) : null}
          <button className="rounded-full border border-foreground/30 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:bg-foreground/5">
            Discard
          </button>
          <button
            onClick={() => void onSaveProfile()}
            disabled={isSaving}
            className="rounded-full bg-[var(--brand-magenta)] px-6 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save profile →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
        {label}
      </span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-full border border-foreground/20 bg-background/70 px-4 py-2 text-sm focus:border-[var(--brand-magenta)] focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}
