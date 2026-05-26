import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs, useTabs } from "@/components/brand/Tabs";
import { products, messages } from "@/mocks/data";

export const Route = createFileRoute("/app/blogger")({
  component: BloggerDash,
});

type Tab = "home" | "products" | "inbox" | "links" | "profile";

function BloggerDash() {
  const [tab, setTab] = useTabs<Tab>("home");

  return (
    <div className="px-6 py-10 md:px-12">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            BLOGGER · Nº 01
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">
            Bonjour, Aria.
          </h1>
        </div>
        <HandwrittenNote>style on</HandwrittenNote>
      </div>

      <div className="mt-8">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "home",     label: "Overview",  sub: "01" },
            { id: "products", label: "Products",  sub: "02" },
            { id: "inbox",    label: "Inbox",     sub: "03" },
            { id: "links",    label: "Send links",sub: "04" },
            { id: "profile",  label: "Profile",   sub: "05" },
          ]}
        />
      </div>

      <div className="mt-8">
        {tab === "home" && <Overview />}
        {tab === "products" && <Products />}
        {tab === "inbox" && <Inbox />}
        {tab === "links" && <Links />}
        {tab === "profile" && <Profile />}
      </div>
    </div>
  );
}

function Overview() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <GlassCard tone="pink">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">STATUS</div>
        <div className="mt-2 font-display text-3xl">Active</div>
        <p className="mt-2 text-sm text-foreground/70">3 posts this month · ahead of pace.</p>
      </GlassCard>
      <GlassCard>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">NEXT DEADLINE</div>
        <div className="mt-2 font-display text-3xl">14 days</div>
        <p className="mt-2 text-sm text-foreground/70">One post per month minimum.</p>
      </GlassCard>
      <GlassCard>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">RULES</div>
        <ul className="mt-3 space-y-2 text-sm">
          <li>· 1 post / month minimum</li>
          <li>· Credit "Love Potion"</li>
          <li>· Tag #lovepotionsl on Flickr</li>
        </ul>
      </GlassCard>
    </div>
  );
}

function Products() {
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

function Inbox() {
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

function Links() {
  return (
    <GlassCard tone="pink" className="max-w-2xl p-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">SUBMIT YOUR POST</div>
      <h3 className="mt-2 font-display text-3xl">Where did the spell land?</h3>
      <div className="mt-6 space-y-4">
        <input placeholder="Flickr URL"   className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm focus:outline-none focus:border-[var(--brand-magenta)]" />
        <input placeholder="Instagram URL"className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm focus:outline-none focus:border-[var(--brand-magenta)]" />
        <input placeholder="Facebook URL" className="w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm focus:outline-none focus:border-[var(--brand-magenta)]" />
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

function Profile() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <GlassCard>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">PROFILE</div>
        <h3 className="mt-2 font-display text-3xl">Aria Solstice</h3>
        <ul className="mt-4 space-y-2 text-sm text-foreground/80">
          <li>SL: Aria.Solstice</li>
          <li>Language: EN</li>
          <li>Flickr: flickr.com/aria</li>
          <li>Joined: MMXXV · 09</li>
        </ul>
      </GlassCard>
      <GlassCard tone="pink">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">MY STATS</div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat n="14" l="posts" />
          <Stat n="92%" l="on-time" />
          <Stat n="4" l="months" />
        </div>
      </GlassCard>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-xl bg-background/60 p-4 text-center">
      <div className="font-display text-3xl">{n}</div>
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/60">{l}</div>
    </div>
  );
}
