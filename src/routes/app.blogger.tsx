import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { products, messages } from "@/mocks/data";
import { cn } from "@/lib/utils";
import bloggerAvatar from "@/assets/blogger-avatar.jpg";

type Tab = "home" | "products" | "posts" | "inbox" | "links" | "profile";
type Status = "active" | "vacation" | "busy";

export const Route = createFileRoute("/app/blogger")({
  validateSearch: (s: Record<string, unknown>): { section?: Tab } => ({
    section: (s.section as Tab) || undefined,
  }),
  component: BloggerDash,
});

const TITLES: Record<Tab, { eyebrow: string; title: string; note: string }> = {
  home:     { eyebrow: "BLOGGER · Nº 01",       title: "Bonjour, Aria.",   note: "style on" },
  products: { eyebrow: "STUDIO · PRODUCTS",     title: "The wardrobe.",    note: "pick a spell" },
  posts:    { eyebrow: "STUDIO · POSTS",        title: "Your gallery.",    note: "share the magic" },
  inbox:    { eyebrow: "STUDIO · MAILBOX",      title: "Messages.",        note: "open with care" },
  links:    { eyebrow: "STUDIO · SUBMIT",       title: "Send your links.", note: "where it landed" },
  profile:  { eyebrow: "STUDIO · PROFILE",      title: "About you.",       note: "set the scene" },
};

function BloggerDash() {
  const navigate = useNavigate({ from: "/app/blogger" });
  const { section } = Route.useSearch();
  const tab: Tab = section ?? "home";
  const setTab = (v: Tab) =>
    navigate({ search: { section: v === "home" ? undefined : v } });

  // Profile state (lifted so overlay note appears across Overview too)
  const [photo, setPhoto] = useState<string>(bloggerAvatar);
  const [overlayNote, setOverlayNote] = useState<string>("on a velvet night ♡");
  const [status, setStatus] = useState<Status>("active");

  const meta = TITLES[tab];

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

      <div className="mt-8">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "home",     label: "Overview",   sub: "01" },
            { id: "products", label: "Products",   sub: "02" },
            { id: "posts",    label: "Posts",      sub: "03" },
            { id: "inbox",    label: "Mailbox",    sub: "04" },
            { id: "links",    label: "Send links", sub: "05" },
            { id: "profile",  label: "Profile",    sub: "06" },
          ]}
        />
      </div>

      <div className="mt-8">
        {tab === "home"     && <Overview photo={photo} note={overlayNote} status={status} />}
        {tab === "products" && <ProductsTab />}
        {tab === "posts"    && <PostsTab />}
        {tab === "inbox"    && <InboxTab />}
        {tab === "links"    && <LinksTab />}
        {tab === "profile"  && (
          <ProfileTab
            photo={photo} setPhoto={setPhoto}
            note={overlayNote} setNote={setOverlayNote}
            status={status} setStatus={setStatus}
          />
        )}
      </div>
    </div>
  );
}

/* ───────── Avatar with Instagram-style overlay note ───────── */

const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  vacation: "On vacation",
  busy: "Busy",
};
const STATUS_COLOR: Record<Status, string> = {
  active:   "bg-[var(--brand-rose)]",
  vacation: "bg-[var(--brand-magenta)]",
  busy:     "bg-foreground/60",
};

function AvatarCard({
  photo, note, status, size = "lg",
}: { photo: string; note: string; status: Status; size?: "sm" | "lg" }) {
  // Instagram-style: max 2 lines, big condensed display type centered
  const lines = (note || "").split("\n").slice(0, 2);
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl",
      size === "lg" ? "aspect-[4/5]" : "aspect-square",
    )}>
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
                style={{ fontSize: size === "lg" ? "clamp(1.5rem, 4vw, 2.75rem)" : "1.25rem" }}
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

/* ───────── Tabs ───────── */

function Overview({ photo, note, status }: { photo: string; note: string; status: Status }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <GlassCard className="md:col-span-1 overflow-hidden p-0">
        <AvatarCard photo={photo} note={note} status={status} />
        <div className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">PROFILE</div>
          <div className="mt-1 font-display text-2xl">Aria Solstice</div>
          <p className="mt-1 font-hand text-lg text-[var(--brand-magenta)] leading-tight">"{note || "—"}"</p>
        </div>
      </GlassCard>
      <div className="md:col-span-2 grid gap-6 sm:grid-cols-2">
        <GlassCard tone="pink">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">STATUS</div>
          <div className="mt-2 font-display text-3xl">{STATUS_LABEL[status]}</div>
          <p className="mt-2 text-sm text-foreground/70">3 posts this month · ahead of pace.</p>
        </GlassCard>
        <GlassCard>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">NEXT DEADLINE</div>
          <div className="mt-2 font-display text-3xl">14 days</div>
          <p className="mt-2 text-sm text-foreground/70">One post per month minimum.</p>
        </GlassCard>
        <GlassCard className="sm:col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">RULES</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>· 1 post / month minimum</li>
            <li>· Credit "Love Potion"</li>
            <li>· Tag #lovepotionsl on Flickr</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}

function ProductsTab() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {products.slice(0, 6).map((p) => (
        <GlassCard key={p.id} className="overflow-hidden p-0">
          <img src={p.img} alt={p.name} loading="lazy" className="aspect-[4/5] w-full object-cover" />
          <div className="p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">{p.added}</div>
            <h3 className="mt-1 font-display text-2xl">{p.name}</h3>
            <button className="mt-4 w-full rounded-full bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
              Deliver to SL →
            </button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function PostsTab() {
  const posts = [
    { id: 1, title: "Velvet 04 — moonlit",    img: products[0].img, date: "2d ago", platform: "Flickr",    likes: 213 },
    { id: 2, title: "Lace Noir on the cliff", img: products[1].img, date: "5d ago", platform: "Instagram", likes: 184 },
    { id: 3, title: "Silk Touch · sunset",    img: products[2].img, date: "1w ago", platform: "Flickr",    likes: 91 },
    { id: 4, title: "Satin Spell",            img: products[3].img, date: "2w ago", platform: "Facebook",  likes: 47 },
  ];
  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
      {posts.map((p) => (
        <GlassCard key={p.id} className="overflow-hidden p-0">
          <img src={p.img} alt={p.title} className="aspect-square w-full object-cover" />
          <div className="p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">{p.platform} · {p.date}</div>
            <div className="mt-1 font-display text-lg leading-tight">{p.title}</div>
            <div className="mt-2 font-mono text-xs text-foreground/70">♡ {p.likes}</div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function InboxTab() {
  return (
    <div className="grid gap-4">
      {messages.map((m) => (
        <GlassCard key={m.id} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`h-2 w-2 rounded-full ${m.unread ? "bg-[var(--brand-magenta)]" : "bg-foreground/20"}`} />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                {m.type === "broadcast" ? "BROADCAST" : "PERSONAL"} · {m.from}
              </div>
              <div className="mt-1 font-display text-lg">{m.subject}</div>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">{m.time}</span>
        </GlassCard>
      ))}
    </div>
  );
}

function LinksTab() {
  return (
    <GlassCard tone="pink" className="max-w-2xl p-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">SUBMIT YOUR POST</div>
      <h3 className="mt-2 font-display text-3xl">Where did the spell land?</h3>
      <div className="mt-6 space-y-4">
        <input placeholder="Flickr URL"    className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm focus:outline-none focus:border-[var(--brand-magenta)]" />
        <input placeholder="Instagram URL" className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm focus:outline-none focus:border-[var(--brand-magenta)]" />
        <input placeholder="Facebook URL"  className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm focus:outline-none focus:border-[var(--brand-magenta)]" />
        <select className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm">
          <option>Product: Velvet 04</option>
          <option>Product: Lace Noir</option>
          <option>Product: Silk Touch</option>
        </select>
        <button className="rounded-full bg-foreground px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
          Send to atelier →
        </button>
      </div>
    </GlassCard>
  );
}

/* ───────── Profile editor ───────── */

const NOTE_MAX = 40; // Instagram-style, very few chars

function ProfileTab(props: {
  photo: string; setPhoto: (v: string) => void;
  note: string; setNote: (v: string) => void;
  status: Status; setStatus: (v: Status) => void;
}) {
  const { photo, setPhoto, note, setNote, status, setStatus } = props;

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhoto(url);
  };

  const onNoteChange = (v: string) => {
    // Limit to 2 lines, NOTE_MAX chars
    const lines = v.split("\n").slice(0, 2);
    const trimmed = lines.join("\n").slice(0, NOTE_MAX);
    setNote(trimmed);
  };

  const statuses: { id: Status; label: string; help: string }[] = [
    { id: "active",   label: "Active",      help: "Posting as usual" },
    { id: "vacation", label: "On vacation", help: "Pause monthly rule" },
    { id: "busy",     label: "Busy",        help: "Reduced activity" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Live preview */}
      <GlassCard className="md:col-span-4 overflow-hidden p-0">
        <AvatarCard photo={photo} note={note} status={status} />
        <div className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">LIVE PREVIEW</div>
          <div className="mt-1 font-display text-2xl">Aria Solstice</div>
          <p className="mt-1 text-sm text-foreground/70">This is how others see you.</p>
        </div>
      </GlassCard>

      {/* Editor */}
      <div className="md:col-span-8 grid gap-6">
        {/* Identity + photo */}
        <GlassCard tone="pink" className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">IDENTITY</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Display name"  defaultValue="Aria Solstice" />
            <Field label="SL avatar"     defaultValue="Aria.Solstice" />
            <Field label="Language"      defaultValue="EN" />
            <Field label="Flickr"        defaultValue="flickr.com/aria" />
          </div>
          <div className="mt-6 flex items-center gap-4">
            <img src={photo} alt="avatar" className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--brand-magenta)]/50" />
            <label className="cursor-pointer rounded-full border border-foreground/30 bg-background/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]">
              Change photo
              <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
            </label>
          </div>
        </GlassCard>

        {/* Overlay note */}
        <GlassCard className="p-6">
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">CUSTOM NOTE</div>
            <span className="font-mono text-[10px] text-foreground/50">
              {note.length}/{NOTE_MAX} · max 2 lines
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
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">STATUS</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">PASSWORD</div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Current"     type="password" />
            <Field label="New"         type="password" />
            <Field label="Confirm new" type="password" />
          </div>
          <div className="mt-5 flex justify-end">
            <button className="rounded-full bg-foreground px-6 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
              Update password
            </button>
          </div>
        </GlassCard>

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3">
          <button className="rounded-full border border-foreground/30 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:bg-foreground/5">
            Discard
          </button>
          <button className="rounded-full bg-[var(--brand-magenta)] px-6 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white hover:opacity-90">
            Save profile →
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, defaultValue, type = "text",
}: { label: string; defaultValue?: string; type?: string }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-full border border-foreground/20 bg-background/70 px-4 py-2 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
      />
    </label>
  );
}
