import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs, useTabs } from "@/components/brand/Tabs";

export const Route = createFileRoute("/app/super-admin")({
  component: SuperDash,
});

type Tab = "settings" | "admins" | "branding" | "logs";

function SuperDash() {
  const [tab, setTab] = useTabs<Tab>("settings");
  return (
    <div className="px-6 py-10 md:px-12">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            SUPER ADMIN · Nº 03
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">
            The control room.
          </h1>
        </div>
        <HandwrittenNote>handle with care</HandwrittenNote>
      </div>

      <div className="mt-8">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "settings", label: "Platform rules", sub: "01" },
            { id: "admins",   label: "Admins",         sub: "02" },
            { id: "branding", label: "Branding",       sub: "03" },
            { id: "logs",     label: "Activity logs",  sub: "04" },
          ]}
        />
      </div>

      <div className="mt-10">
        {tab === "settings" && <Settings />}
        {tab === "admins"   && <Admins />}
        {tab === "branding" && <Branding />}
        {tab === "logs"     && <Logs />}
      </div>
    </div>
  );
}

function Settings() {
  const rules = [
    { k: "Default post frequency",   v: "1 / month", o: ["1 / month", "2 / month", "1 / week", "Free"] },
    { k: "Auto-archive products after", v: "90 days", o: ["30 days", "60 days", "90 days", "120 days"] },
    { k: "Inactivity warning at",    v: "21 days",   o: ["7 days", "14 days", "21 days", "30 days"] },
    { k: "Auto-remove inactive at",  v: "60 days",   o: ["30 days", "60 days", "90 days", "Never"] },
  ];
  return (
    <div className="grid gap-4">
      {rules.map((r, i) => (
        <GlassCard key={r.k} tone={i % 2 === 0 ? "light" : "pink"} className="flex items-center justify-between gap-6 p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">Nº 0{i + 1}</div>
            <h3 className="mt-1 font-display text-xl">{r.k}</h3>
          </div>
          <select className="rounded-full border border-foreground/30 bg-background/70 px-4 py-2 font-mono text-xs">
            {r.o.map(opt => <option key={opt} selected={opt === r.v}>{opt}</option>)}
          </select>
        </GlassCard>
      ))}
    </div>
  );
}

function Admins() {
  const admins = [
    { n: "Casteli (owner)", r: "Super Admin", e: "owner@lovepotion.sl" },
    { n: "Mireille Velour", r: "Admin",       e: "mireille@lovepotion.sl" },
    { n: "Iris D'Ambrosio", r: "Admin",       e: "iris@lovepotion.sl" },
  ];
  return (
    <GlassCard className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
          <tr>
            <th className="px-6 py-4 text-left">Name</th>
            <th className="px-6 py-4 text-left">Role</th>
            <th className="px-6 py-4 text-left">Email</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody>
          {admins.map(a => (
            <tr key={a.n} className="border-b border-foreground/5">
              <td className="px-6 py-4 font-display text-lg">{a.n}</td>
              <td className="px-6 py-4">
                <span className="rounded-full bg-foreground px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-background">{a.r}</span>
              </td>
              <td className="px-6 py-4 text-foreground/70">{a.e}</td>
              <td className="px-6 py-4 text-right">
                <button className="rounded-full border border-foreground/30 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-foreground/10 p-4">
        <button className="rounded-full bg-foreground px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
          + Add admin
        </button>
      </div>
    </GlassCard>
  );
}

function Branding() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <GlassCard tone="pink" className="p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">PALETTE</div>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {["#f17aa9","#db1861","#f06883","#fac9d1"].map(c => (
            <div key={c} className="overflow-hidden rounded-xl text-center">
              <div className="aspect-square w-full" style={{ background: c }} />
              <div className="bg-background/80 py-1 font-mono text-[9px] uppercase tracking-[0.2em]">{c}</div>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard className="p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">SLOGAN</div>
        <input defaultValue="Style that casts a spell." className="mt-4 w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm" />
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">TAGLINE (ES)</div>
        <input defaultValue="Un estilo que lanza un hechizo." className="mt-4 w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 text-sm" />
      </GlassCard>
    </div>
  );
}

function Logs() {
  const logs = [
    { t: "2m",  who: "Casteli",     a: "Updated archive rule to 90 days" },
    { t: "1h",  who: "Mireille",    a: "Approved application: Lyra Hollow" },
    { t: "3h",  who: "system",      a: "Auto-warned 3 inactive bloggers" },
    { t: "1d",  who: "Iris",        a: "Sent broadcast: House rules — March update" },
    { t: "2d",  who: "system",      a: "Archived product: Cashmere Mist (>90d)" },
  ];
  return (
    <GlassCard className="p-0">
      <ul>
        {logs.map((l, i) => (
          <li key={i} className="flex items-center justify-between border-b border-foreground/5 px-6 py-4 last:border-0">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50 w-10">{l.t}</span>
              <span className="font-display text-base">{l.a}</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">{l.who}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
