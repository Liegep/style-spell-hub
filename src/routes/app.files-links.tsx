import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ImagePlus, Link2, Pencil, Save, Trash2, X } from "lucide-react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCurrentProfile } from "@/integrations/supabase/auth";
import type { SharedResource } from "@/integrations/supabase/database.types";
import {
  createSharedImage,
  createSharedLink,
  deleteSharedResource,
  listSharedResources,
  updateSharedResource,
} from "@/integrations/supabase/resources";

export const Route = createFileRoute("/app/files-links")({
  component: FilesLinksPage,
});

function FilesLinksPage() {
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", url: "", description: "", sort_order: 0 });
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");

  const [imgTitle, setImgTitle] = useState("");
  const [imgDesc, setImgDesc] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);

  async function load() {
    setState("loading");
    setMessage("");
    try {
      const [profile, rows] = await Promise.all([getCurrentProfile(), listSharedResources()]);
      setIsSuper(profile?.role === "super_admin");
      setResources(rows);
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not load files and links.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const links = useMemo(() => resources.filter((item) => item.kind === "link"), [resources]);
  const images = useMemo(() => resources.filter((item) => item.kind === "image"), [resources]);

  async function onAddLink(event: React.FormEvent) {
    event.preventDefault();
    if (!isSuper) return;
    setMessage("");
    try {
      const row = await createSharedLink({
        title: linkTitle,
        url: normalizeUrl(linkUrl),
        description: linkDesc || null,
      });
      setResources((current) => [row, ...current]);
      setLinkTitle("");
      setLinkUrl("");
      setLinkDesc("");
      setLinkModalOpen(false);
      setMessage("Link added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add link.");
    }
  }

  async function onAddImage(event: React.FormEvent) {
    event.preventDefault();
    if (!imgFile) {
      setMessage("Select an image first.");
      return;
    }
    setMessage("");
    try {
      const row = await createSharedImage({
        title: imgTitle,
        file: imgFile,
        description: imgDesc || null,
      });
      setResources((current) => [row, ...current]);
      setImgTitle("");
      setImgDesc("");
      setImgFile(null);
      setImageModalOpen(false);
      setMessage("Image uploaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload image.");
    }
  }

  async function onDelete(id: string) {
    setMessage("");
    try {
      await deleteSharedResource(id);
      setResources((current) => current.filter((item) => item.id !== id));
      setMessage("Item deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete item.");
    }
  }

  function startEdit(item: SharedResource) {
    setEditingId(item.id);
    setEditDraft({
      title: item.title,
      url: item.url,
      description: item.description ?? "",
      sort_order: item.sort_order,
    });
  }

  async function onSaveEdit(item: SharedResource) {
    setMessage("");
    try {
      const url = item.kind === "link" ? normalizeUrl(editDraft.url) : editDraft.url.trim();
      const updated = await updateSharedResource(item.id, {
        title: editDraft.title,
        url,
        description: editDraft.description || null,
        sort_order: editDraft.sort_order,
      });
      setResources((current) => current.map((resource) => (resource.id === updated.id ? updated : resource)));
      setEditingId(null);
      setMessage("Item updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update item.");
    }
  }

  async function copyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      input.style.top = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1600);
  }

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            {isSuper ? "SUPER ADMIN · FILES" : "ADMIN · FILES"}
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">Files & links.</h1>
        </div>
        <HandwrittenNote>share the kit</HandwrittenNote>
      </header>

      {message ? (
        <div className="mt-6 rounded-xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/30 px-4 py-3 text-sm text-[var(--brand-magenta)]">
          {message}
        </div>
      ) : null}

      {state === "error" ? (
        <GlassCard className="mt-8 p-6">
          <p className="text-sm text-foreground/75">{message || "Could not load resources."}</p>
          <button
            onClick={() => void load()}
            className="mt-4 rounded-full bg-foreground px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background"
          >
            Retry
          </button>
        </GlassCard>
      ) : null}

      {isSuper ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white transition hover:bg-foreground"
          >
            <Link2 className="h-4 w-4" />
            Add link
          </button>
          <button
            type="button"
            onClick={() => setImageModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background transition hover:bg-[var(--brand-magenta)]"
          >
            <ImagePlus className="h-4 w-4" />
            Upload image
          </button>
        </div>
      ) : null}

      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl border-[var(--brand-pink)] bg-background p-8">
          <DialogHeader>
            <DialogTitle className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              Add link
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onAddLink} className="grid gap-3">
            <input
              value={linkTitle}
              onChange={(event) => setLinkTitle(event.target.value)}
              placeholder="Mainstore, Event board..."
              required
              className={inputClass}
            />
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://..."
              required
              className={inputClass}
            />
            <input
              value={linkDesc}
              onChange={(event) => setLinkDesc(event.target.value)}
              placeholder="Small note (optional)"
              className={inputClass}
            />
            <button className="mt-2 rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white hover:bg-foreground">
              + Add link
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl border-[var(--brand-pink)] bg-background p-8">
          <DialogHeader>
            <DialogTitle className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              Upload image
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onAddImage} className="grid gap-3">
            <input
              value={imgTitle}
              onChange={(event) => setImgTitle(event.target.value)}
              placeholder="Logo texture, brand pack..."
              required
              className={inputClass}
            />
            <input
              type="file"
              accept="image/*"
              required
              onChange={(event) => setImgFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-foreground/70 file:mr-4 file:rounded-full file:border file:border-foreground/20 file:bg-background file:px-4 file:py-2 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.25em]"
            />
            <input
              value={imgDesc}
              onChange={(event) => setImgDesc(event.target.value)}
              placeholder="Small note (optional)"
              className={inputClass}
            />
            <button className="mt-2 rounded-full bg-foreground px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)]">
              <span className="inline-flex items-center justify-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Upload image
              </span>
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <GlassCard className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            <span>Shared links</span> ({links.length})
          </div>
          <div className="mt-4 space-y-3">
            {links.map((item) => (
              <div key={item.id} className="rounded-xl border border-foreground/15 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingId === item.id ? (
                      <div className="grid gap-2">
                        <input
                          value={editDraft.title}
                          onChange={(event) => setEditDraft((draft) => ({ ...draft, title: event.target.value }))}
                          className={inputClass}
                        />
                        <input
                          value={editDraft.url}
                          onChange={(event) => setEditDraft((draft) => ({ ...draft, url: event.target.value }))}
                          className={inputClass}
                        />
                        <input
                          value={editDraft.description}
                          onChange={(event) => setEditDraft((draft) => ({ ...draft, description: event.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="font-display text-xl">{item.title}</div>
                        {item.description ? (
                          <p className="mt-1 text-sm text-foreground/65">{item.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={() => void copyText(item.id, item.url)}
                            className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                          >
                            {copiedId === item.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedId === item.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {isSuper ? (
                    <div className="flex shrink-0 items-center gap-1">
                      {editingId === item.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void onSaveEdit(item)}
                            className="rounded-full p-2 text-foreground/55 hover:bg-emerald-100 hover:text-emerald-700"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-full p-2 text-foreground/55 hover:bg-foreground/10"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-full p-2 text-foreground/55 hover:bg-foreground/10"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDelete(item.id)}
                            className="rounded-full p-2 text-foreground/55 hover:bg-rose-100 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
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
            <span>Shared images</span> ({images.length})
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {images.map((item) => (
              <div key={item.id} className="rounded-xl border border-foreground/15 p-3">
                <img src={item.url} alt={item.title} className="aspect-[4/3] w-full rounded-lg object-cover" />
                {editingId === item.id ? (
                  <div className="mt-2 grid gap-2">
                    <input
                      value={editDraft.title}
                      onChange={(event) => setEditDraft((draft) => ({ ...draft, title: event.target.value }))}
                      className={inputClass}
                    />
                    <input
                      value={editDraft.description}
                      onChange={(event) => setEditDraft((draft) => ({ ...draft, description: event.target.value }))}
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <>
                    <div className="mt-2 font-display text-lg">{item.title}</div>
                    {item.description ? (
                      <p className="text-sm text-foreground/65">{item.description}</p>
                    ) : null}
                  </>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={getDownloadUrl(item.url, getDownloadFilename(item.url, item.title))}
                    download={getDownloadFilename(item.url, item.title)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                  >
                    Open
                  </a>
                  {isSuper ? (
                    editingId === item.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void onSaveEdit(item)}
                          className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-100 hover:text-emerald-700"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/10"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(item.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-rose-600 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </>
                    )
                  ) : null}
                </div>
              </div>
            ))}
            {images.length === 0 ? (
              <div className="rounded-xl border border-dashed border-foreground/15 p-6 text-center font-hand text-2xl text-[var(--brand-magenta)] sm:col-span-2">
                no images yet
              </div>
            ) : null}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const inputClass =
  "w-full rounded-full border border-foreground/20 bg-background/80 px-4 py-2 text-sm outline-none focus:border-[var(--brand-magenta)]";

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
