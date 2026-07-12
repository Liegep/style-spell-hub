import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Save, Trash2, UserPlus } from "lucide-react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { translateAppPhrase } from "@/i18n/app-text";
import { useLang } from "@/i18n/dict";
import {
  createManagerAccount,
  listManagers,
  removeManagerAccount,
  updateManagerDetails,
  type ManagerListItem,
  type ManagerRole,
} from "@/integrations/supabase/managers-admin";
import type { AccountStatus } from "@/integrations/supabase/database.types";

type ManagerFilter = "all" | "admin" | "super" | "inactive";
type EditorMode = { type: "create" } | { type: "edit"; manager: ManagerListItem };

export const Route = createFileRoute("/app/managers")({
  ssr: false,
  loader: async () => {
    try {
      return {
        managers: await listManagers(),
        error: "",
      };
    } catch (error) {
      return {
        managers: [] as ManagerListItem[],
        error: error instanceof Error ? error.message : "Could not load managers.",
      };
    }
  },
  component: ManagersPage,
});

function ManagersPage() {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const initialData = Route.useLoaderData();
  const [filter, setFilter] = useState<ManagerFilter>("all");
  const [managers, setManagers] = useState<ManagerListItem[]>(initialData.managers);
  const [state, setState] = useState<"loading" | "ready" | "error">(initialData.error ? "error" : "ready");
  const [message, setMessage] = useState(initialData.error);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadManagers() {
    try {
      setState("loading");
      const rows = await listManagers();
      setManagers(rows);
      setState("ready");
      setMessage("");
    } catch (error) {
      console.error("[Managers] Failed to load managers", error);
      setMessage(error instanceof Error ? error.message : "Could not load managers.");
      setState("error");
    }
  }

  async function removeManager(manager: ManagerListItem) {
    if (confirmRemoveId !== manager.id) {
      setConfirmRemoveId(manager.id);
      setMessage(`${tr("Click confirm to remove")} ${manager.display_name ?? manager.email}.`);
      return;
    }

    try {
      setRemovingId(manager.id);
      const updated = await removeManagerAccount(manager.id);
      setManagers((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setConfirmRemoveId(null);
      setMessage(`${updated.display_name ?? updated.email} ${tr("was moved to inactive.")}`);
    } catch (error) {
      console.error("[Managers] Failed to remove manager", error);
      setMessage(error instanceof Error ? error.message : "Could not remove manager.");
    } finally {
      setRemovingId(null);
    }
  }

  const filtered = useMemo(() => {
    return managers.filter((manager) => {
      if (filter === "all") return true;
      if (filter === "admin") return manager.role === "admin";
      if (filter === "super") return manager.role === "super_admin";
      return manager.account_status !== "active";
    });
  }, [filter, managers]);

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {tr("SUPER ADMIN · MANAGERS")}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">{tr("The keepers.")}</h1>
        </div>
        <HandwrittenNote>{tr("trusted hands")}</HandwrittenNote>
      </header>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs<ManagerFilter>
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: "all", label: tr("All managers"), sub: "01" },
            { id: "admin", label: tr("Admins"), sub: "02" },
            { id: "super", label: tr("Super admins"), sub: "03" },
            { id: "inactive", label: tr("Inactive"), sub: "04" },
          ]}
        />
        <button
          onClick={() => setEditor({ type: "create" })}
          className="rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white shadow-lg shadow-[var(--brand-magenta)]/20 hover:opacity-90"
        >
          <UserPlus className="mr-2 inline h-4 w-4" />
          {tr("Create manager")}
        </button>
      </div>

      {message ? (
        <div className="mt-6 rounded-3xl border border-[var(--brand-pink)] bg-[var(--brand-pink)]/50 px-5 py-4 text-sm text-foreground/70">
          {tr(message)}
        </div>
      ) : null}

      <GlassCard className="mt-10 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              <tr>
                <th className="px-6 py-4 text-left">{tr("Name")}</th>
                <th className="px-6 py-4 text-left">{tr("Role")}</th>
                <th className="px-6 py-4 text-left">{tr("Email")}</th>
                <th className="px-6 py-4 text-left">{tr("Status")}</th>
                <th className="px-6 py-4 text-left">{tr("Updated")}</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {state === "loading" ? (
                [0, 1, 2].map((row) => (
                  <tr key={row} className="border-b border-foreground/5 last:border-0">
                    <td className="px-6 py-5"><div className="h-5 w-36 rounded-full bg-[var(--brand-pink)]/60" /></td>
                    <td className="px-6 py-5"><div className="h-5 w-24 rounded-full bg-[var(--brand-pink)]/60" /></td>
                    <td className="px-6 py-5"><div className="h-5 w-52 rounded-full bg-[var(--brand-pink)]/60" /></td>
                    <td className="px-6 py-5"><div className="h-5 w-20 rounded-full bg-[var(--brand-pink)]/60" /></td>
                    <td className="px-6 py-5"><div className="h-5 w-24 rounded-full bg-[var(--brand-pink)]/60" /></td>
                    <td className="px-6 py-5" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-foreground/55">
                    {tr("No managers in this view yet.")}
                  </td>
                </tr>
              ) : (
                filtered.map((manager) => (
                  <tr key={manager.id} className="border-b border-foreground/5 last:border-0">
                    <td className="px-6 py-4 font-display text-lg">
                      {manager.display_name ?? manager.full_name ?? tr("Unnamed manager")}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex whitespace-nowrap rounded-full bg-foreground px-4 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-background">
                        {tr(humanRole(manager.role))}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground/70">{manager.email}</td>
                    <td className="px-6 py-4">
                      <StatusPill status={manager.account_status} />
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/45">
                      {manager.updated_at ? formatDate(manager.updated_at, language) : tr("Never")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditor({ type: "edit", manager })}
                          className="rounded-full border border-foreground/30 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] hover:bg-foreground hover:text-background"
                        >
                          {tr("Edit")}
                        </button>
                        <button
                          onClick={() => void removeManager(manager)}
                          disabled={removingId === manager.id || manager.account_status === "blocked" || manager.account_status === "left"}
                          className="inline-flex items-center rounded-full border border-[var(--brand-magenta)]/40 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)] hover:bg-[var(--brand-magenta)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {removingId === manager.id
                            ? tr("Removing")
                            : confirmRemoveId === manager.id
                              ? tr("Confirm")
                              : tr("Remove")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {editor ? (
        <ManagerEditor
          mode={editor}
          onClose={() => setEditor(null)}
          onSaved={(manager) => {
            setManagers((current) => {
              const exists = current.some((row) => row.id === manager.id);
              return exists
                ? current.map((row) => (row.id === manager.id ? manager : row))
                : [manager, ...current];
            });
            setEditor(null);
            setMessage(`${manager.display_name ?? manager.email} saved.`);
          }}
        />
      ) : null}
    </div>
  );
}

function ManagerEditor({
  mode,
  onClose,
  onSaved,
}: {
  mode: EditorMode;
  onClose: () => void;
  onSaved: (manager: ManagerListItem) => void;
}) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const isCreate = mode.type === "create";
  const manager = mode.type === "edit" ? mode.manager : null;
  const [displayName, setDisplayName] = useState(manager?.display_name ?? manager?.full_name ?? "");
  const [email, setEmail] = useState(manager?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ManagerRole>((manager?.role as ManagerRole | undefined) ?? "admin");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(manager?.account_status ?? "active");
  const [state, setState] = useState<"ready" | "saving">("ready");
  const [error, setError] = useState("");

  async function saveManager(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setError("");

    try {
      const saved = isCreate
        ? await createManagerAccount({
            email,
            password,
            displayName,
            role,
            accountStatus,
          })
        : await updateManagerDetails({
            managerId: manager.id,
            displayName,
            role,
            accountStatus,
          });

      onSaved(saved);
    } catch (saveError) {
      console.error("[Managers] Failed to save manager", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save manager.");
      setState("ready");
    }
  }

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/55 px-4 py-8 backdrop-blur-sm"
    >
      <form
        onSubmit={saveManager}
        className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--brand-pink)] bg-background p-6 shadow-2xl md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              {isCreate ? tr("New manager") : tr("Manager dossier")}
            </div>
            <h2 className="mt-2 font-display text-5xl leading-none">
              {isCreate ? tr("Invite a keeper.") : tr("Tune access.")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-foreground/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em]"
          >
            {tr("Close")}
          </button>
        </div>

        <div className="mt-8 grid gap-5">
          <Field label={tr("Display name")}>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
              required
              placeholder="Mireille Velour"
            />
          </Field>
          <Field label={tr("Email")}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              required
              disabled={!isCreate}
              placeholder="manager@lovepotion.sl"
            />
          </Field>
          {isCreate ? (
            <Field label={tr("Initial password")}>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                required
                minLength={8}
                placeholder={tr("At least 8 characters")}
              />
            </Field>
          ) : null}
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={tr("Role")}>
              <select value={role} onChange={(event) => setRole(event.target.value as ManagerRole)} className={inputClass}>
                <option value="admin">{tr("Admin")}</option>
                <option value="super_admin">{tr("Super Admin")}</option>
              </select>
            </Field>
            <Field label={tr("Status")}>
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
          </div>

          {error ? (
            <div className="rounded-2xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)] p-4 text-sm text-[var(--brand-magenta)]">
              {tr(error)}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-foreground/10 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-foreground/20 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em]"
          >
            {tr("Cancel")}
          </button>
          <button
            type="submit"
            disabled={state === "saving"}
            className="rounded-full bg-foreground px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-wait disabled:opacity-60"
          >
            <Save className="mr-2 inline h-4 w-4" />
            {state === "saving" ? tr("Saving...") : isCreate ? tr("Create manager") : tr("Save manager")}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatusPill({ status }: { status: AccountStatus }) {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const isActive = status === "active";
  return (
    <span
      className={`rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] ${
        isActive ? "bg-emerald-500 text-white" : "bg-[var(--brand-pink)] text-[var(--brand-magenta)]"
      }`}
    >
      {tr(status === "active" ? "Active" : status === "pending" ? "Pending" : status === "blocked" ? "Blocked" : "Left")}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function humanRole(role: string) {
  return role === "super_admin" ? "Super Admin" : "Admin";
}

function formatDate(value: string | null | undefined, language: "en" | "es" = "en") {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString(language === "es" ? "es" : undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

const inputClass =
  "w-full rounded-2xl border border-foreground/15 bg-background/70 px-5 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)] disabled:cursor-not-allowed disabled:opacity-60";
