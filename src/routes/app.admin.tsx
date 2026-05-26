import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { bloggers, products, messages, applications, stats } from "@/mocks/data";
import { cn } from "@/lib/utils";

type Tab =
  | "overview" | "bloggers" | "products" | "form" | "inbox" | "newsletter" | "apps"
  | "locations" | "preferences" | "notifications" | "subscribers";

export const Route = createFileRoute("/app/admin")({
  validateSearch: (s: Record<string, unknown>): { section?: Tab } => ({
    section: (s.section as Tab) || undefined,
  }),
  component: AdminDash,
});

const TITLES: Partial<Record<Tab, { eyebrow: string; title: string; note: string }>> = {
  overview:      { eyebrow: "ADMIN · Nº 02",         title: "The atelier.",        note: "run the house" },
  bloggers:      { eyebrow: "EASYBLOGGERS · FRIENDS", title: "The friends.",        note: "your inner circle" },
  apps:          { eyebrow: "EASYBLOGGERS · APPLY",   title: "Hopefuls.",           note: "review with care" },
  locations:     { eyebrow: "EASYBLOGGERS · MAP",     title: "On the grid.",        note: "where they pose" },
  products:      { eyebrow: "EASYBLOGGERS · STOCK",   title: "The drops.",          note: "fresh on shelves" },
  preferences:   { eyebrow: "EASYBLOGGERS · RULES",   title: "House rules.",        note: "set the tempo" },
  notifications: { eyebrow: "EASYBLOGGERS · INBOX",   title: "Whispers.",           note: "stay in touch" },
  form:          { eyebrow: "EASYBLOGGERS · FORM",    title: "Build the gate.",     note: "shape the question" },
  inbox:         { eyebrow: "ADMIN · COMPOSE",        title: "Write a love note.",  note: "from you, to them" },
  subscribers:   { eyebrow: "EASYSUBSCRIBERS · LIST", title: "The list.",           note: "people who care" },
  newsletter:    { eyebrow: "EASYSUBSCRIBERS · SEND", title: "A new edition.",      note: "send to grid" },
};

function AdminDash() {
  const navigate = useNavigate({ from: "/app/admin" });
  const { section } = Route.useSearch();
  const tab: Tab = section ?? "overview";
  const setTab = (v: Tab) =>
    navigate({ search: { section: v === "overview" ? undefined : v } });
  const meta = TITLES[tab] ?? TITLES.overview!;
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
            { id: "overview",   label: "Overview",     sub: "01" },
            { id: "bloggers",   label: "Friends",      sub: "02" },
            { id: "products",   label: "Products",     sub: "03" },
            { id: "apps",       label: "Applications", sub: "04" },
            { id: "form",       label: "Form builder", sub: "05" },
            { id: "inbox",      label: "Compose",      sub: "06" },
            { id: "newsletter", label: "Newsletter",   sub: "07" },
          ]}
        />
      </div>

      <div className="mt-10">
        {tab === "overview" && <Overview />}
        {tab === "bloggers" && <Bloggers />}
        {tab === "products" && <Products />}
        {tab === "apps" && <Applications />}
        {tab === "form" && <FormBuilder />}
        {tab === "inbox" && <Compose />}
        {tab === "newsletter" && <Newsletter />}
        {tab === "locations" && <Locations />}
        {tab === "preferences" && <Preferences />}
        {tab === "notifications" && <Notifications />}
        {tab === "subscribers" && <Subscribers />}
      </div>
    </div>
  );
}

function Overview() {
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

function Bloggers() {
  const statusColor = (s: string) =>
    s === "active" ? "bg-[var(--brand-rose)] text-white" :
    s === "warning" ? "bg-[var(--brand-coral)] text-white" :
    s === "inactive" ? "bg-foreground/20 text-foreground/70" :
    "bg-[var(--brand-magenta)] text-white";
  return (
    <GlassCard className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-foreground/10">
          <tr className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            <th className="px-6 py-4 text-left">Blogger</th>
            <th className="px-6 py-4 text-left">Status</th>
            <th className="px-6 py-4 text-left">Posts</th>
            <th className="px-6 py-4 text-left">Last</th>
            <th className="px-6 py-4 text-left">Lang</th>
            <th className="px-6 py-4 text-left">Frequency</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody>
          {bloggers.map((b) => (
            <tr key={b.id} className="border-b border-foreground/5 hover:bg-foreground/5">
              <td className="px-6 py-4 font-display text-lg">{b.name}</td>
              <td className="px-6 py-4">
                <span className={cn("rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]", statusColor(b.status))}>
                  {b.status}
                </span>
              </td>
              <td className="px-6 py-4">{b.posts}</td>
              <td className="px-6 py-4 text-foreground/70">{b.last}</td>
              <td className="px-6 py-4 font-mono text-xs">{b.lang}</td>
              <td className="px-6 py-4 font-mono text-xs">{b.frequency}</td>
              <td className="px-6 py-4 text-right">
                <button className="rounded-full border border-foreground/30 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] hover:bg-foreground hover:text-background">
                  Open →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
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

function Applications() {
  return (
    <div className="grid gap-4">
      {applications.map((a) => (
        <GlassCard key={a.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              Applied {a.submitted} · {a.lang}
            </div>
            <h3 className="mt-1 font-display text-2xl">{a.name}</h3>
            <a className="font-mono text-xs text-[var(--brand-magenta)] hover:underline" href="#">{a.flickr}</a>
          </div>
          <div className="flex gap-2">
            <button className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-foreground/5">
              Review
            </button>
            <button className="rounded-full bg-[var(--brand-magenta)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white hover:opacity-90">
              Approve ✓
            </button>
            <button className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-foreground/5">
              Decline
            </button>
          </div>
        </GlassCard>
      ))}
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

function Compose() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <GlassCard tone="pink" className="md:col-span-2 p-8">
        <div className="flex items-center gap-2">
          <button className="rounded-full bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background">Personal</button>
          <button className="rounded-full border border-foreground/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em]">Broadcast (all)</button>
        </div>
        <div className="mt-6 space-y-4">
          <input placeholder="To: Aria Solstice" className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm" />
          <input placeholder="Subject" className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm" />
          <textarea rows={10} placeholder="Write something with style…" className="w-full rounded-2xl border border-foreground/30 bg-background/70 px-5 py-3 text-sm" />
          <div className="flex justify-end">
            <button className="rounded-full bg-foreground px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
              Send →
            </button>
          </div>
        </div>
      </GlassCard>
      <GlassCard>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">SENT · RECENT</div>
        <ul className="mt-4 space-y-3">
          {messages.map(m => (
            <li key={m.id} className="border-b border-foreground/10 pb-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/50">{m.type} · {m.time}</div>
              <div className="mt-1 font-display text-base">{m.subject}</div>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}

function Newsletter() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <GlassCard tone="pink" className="p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">NEW NEWSLETTER</div>
        <input placeholder="Title" className="mt-4 w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm" />
        <textarea rows={6} placeholder="Body text…" className="mt-4 w-full rounded-2xl border border-foreground/30 bg-background/70 px-5 py-3 text-sm" />
        <div className="mt-4 rounded-xl border-2 border-dashed border-foreground/30 p-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
          Drop a photo here · sent in-world with your text
        </div>
        <div className="mt-6 flex justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">{stats.subscribers} subscribers</span>
          <button className="rounded-full bg-foreground px-6 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
            Send to grid →
          </button>
        </div>
      </GlassCard>
      <GlassCard className="p-0 overflow-hidden">
        <img src={products[1].img} alt="preview" className="aspect-[4/3] w-full object-cover" />
        <div className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">LOVE POTION · NEWS · PREVIEW</div>
          <h3 className="mt-2 font-display text-2xl">Velvet 04 has arrived</h3>
          <p className="mt-2 text-sm text-foreground/75">A new gown, four colors, fitted for every body. Try the demo at the mainstore.</p>
        </div>
      </GlassCard>
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

function Notifications() {
  const items = [
    { t: "1h",  k: "warning", title: "Naya Cassidy is inactive (42 days)" },
    { t: "3h",  k: "info",    title: "New application: Lyra Hollow" },
    { t: "6h",  k: "info",    title: "Silk Touch auto-archives in 29 days" },
    { t: "1d",  k: "success", title: "Aria Solstice posted Velvet 04" },
    { t: "2d",  k: "warning", title: "Sasha Vermillion missed her monthly post" },
    { t: "3d",  k: "info",    title: "Newsletter delivered to 1,840 subscribers" },
  ];
  const dot = (k: string) =>
    k === "warning" ? "bg-[var(--brand-magenta)]" :
    k === "success" ? "bg-[var(--brand-rose)]"    :
                      "bg-foreground/30";
  return (
    <GlassCard className="p-0">
      <ul>
        {items.map((m, i) => (
          <li key={i} className="flex items-center gap-5 border-b border-foreground/5 px-6 py-4 last:border-0">
            <span className={cn("h-2 w-2 rounded-full", dot(m.k))} />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50 w-10">{m.t}</span>
            <span className="font-display text-base">{m.title}</span>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/40">{m.k}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function Subscribers() {
  const subs = [
    { n: "Aurora Belle",       e: "aurora@sl.grid",      since: "12 mo", lang: "EN", opens: "92%" },
    { n: "Mireille Velour",    e: "mireille@sl.grid",    since: "9 mo",  lang: "ES", opens: "88%" },
    { n: "Coco Argentum",      e: "coco@sl.grid",        since: "7 mo",  lang: "EN", opens: "74%" },
    { n: "Lyra Hollow",        e: "lyra@sl.grid",        since: "4 mo",  lang: "EN", opens: "61%" },
    { n: "Pilar Estrella",     e: "pilar@sl.grid",       since: "3 mo",  lang: "ES", opens: "55%" },
    { n: "Margaux Plume",      e: "margaux@sl.grid",     since: "2 mo",  lang: "ES", opens: "47%" },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-4">
      <GlassCard tone="pink" className="md:col-span-1 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">TOTAL</div>
        <div className="mt-2 font-display text-6xl leading-none">{stats.subscribers}</div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">subscribers</div>
        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between"><span>EN</span><span className="font-mono">62%</span></div>
          <div className="flex justify-between"><span>ES</span><span className="font-mono">38%</span></div>
          <div className="flex justify-between"><span>Avg. open rate</span><span className="font-mono">69%</span></div>
        </div>
      </GlassCard>
      <GlassCard className="md:col-span-3 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-foreground/10">
            <tr className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              <th className="px-6 py-4 text-left">Name</th>
              <th className="px-6 py-4 text-left">Email</th>
              <th className="px-6 py-4 text-left">Since</th>
              <th className="px-6 py-4 text-left">Lang</th>
              <th className="px-6 py-4 text-left">Opens</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.n} className="border-b border-foreground/5 hover:bg-foreground/5">
                <td className="px-6 py-4 font-display text-lg">{s.n}</td>
                <td className="px-6 py-4 text-foreground/70">{s.e}</td>
                <td className="px-6 py-4 font-mono text-xs">{s.since}</td>
                <td className="px-6 py-4 font-mono text-xs">{s.lang}</td>
                <td className="px-6 py-4 font-mono text-xs">{s.opens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
