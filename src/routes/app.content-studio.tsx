import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Archive, Check, ImagePlus, Save, Star, Trash2, X } from "lucide-react";
import heroImg from "@/assets/hero-marie.png";
import loginImg from "@/assets/login-editorial.jpg";
import aboutImg from "@/assets/about-editorial.jpg";
import release2 from "@/assets/release-2.jpg";
import logoIcon from "@/assets/logo-icon.png";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { Tabs } from "@/components/brand/Tabs";
import { dict, type Lang } from "@/i18n/dict";
import { getProductSummaries, type ProductSummary } from "@/integrations/supabase/dashboard";
import {
  archiveProductRelease,
  deleteProductRelease,
  getProductRelease,
  listProductReleaseImages,
  makeProductId,
  replaceProductReleaseImages,
  upsertProductRelease,
  uploadProductImage,
  type ProductReleaseInput,
} from "@/integrations/supabase/products";
import {
  getSiteAssetMap,
  uploadSiteAssetImage,
  upsertSiteAsset,
  type SiteAsset,
  type SiteAssetKey,
} from "@/integrations/supabase/site-assets";
import { listSiteContent, upsertSiteContent } from "@/integrations/supabase/site-content";
import { listBloggers } from "@/integrations/supabase/bloggers-admin";
import { notifySecondLifeQuietly } from "@/integrations/supabase/messages";
import type { ProductRelease, ProductStatus } from "@/integrations/supabase/database.types";

type StudioTab = "products" | "archived" | "assets" | "content";
type EditorMode = { type: "create" } | { type: "edit"; id: string };

export const Route = createFileRoute("/app/content-studio")({
  component: ContentStudioPage,
});

function ContentStudioPage() {
  const location = useLocation();
  const [tab, setTab] = useState<StudioTab>("products");
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const uiLang: Lang = (location.search as { uiLang?: string } | undefined)?.uiLang === "es" ? "es" : "en";

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            ADMIN · STUDIO
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">Content Studio.</h1>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
            Manage the Love Potion experience
          </p>
        </div>
        <HandwrittenNote>make it official</HandwrittenNote>
      </header>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs<StudioTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "products", label: "Products", sub: "01" },
            { id: "archived", label: "Archived", sub: "02" },
            { id: "assets", label: "Assets", sub: "03" },
            { id: "content", label: "Content", sub: "04" },
          ]}
        />
        <button
          onClick={() => {
            setTab("products");
            setEditor({ type: "create" });
          }}
          className="rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white shadow-lg shadow-[var(--brand-magenta)]/20 hover:opacity-90"
        >
          + Create new release
        </button>
      </div>

      <div className="mt-10">
        {tab === "products" && (
          <ProductsPanel
            refreshKey={refreshKey}
            view="active"
            title="Product releases"
            emptyTitle="no releases yet"
            emptyBody="Create a new release when you are ready to send products to bloggers."
            onEdit={(id) => setEditor({ type: "edit", id })}
          />
        )}
        {tab === "archived" && (
          <ProductsPanel
            refreshKey={refreshKey}
            view="archived"
            title="Archived releases"
            emptyTitle="no archived releases"
            emptyBody="Archived products will appear here when you retire a release."
            onEdit={(id) => setEditor({ type: "edit", id })}
          />
        )}
        {tab === "assets" && <AssetsPanel />}
        {tab === "content" && <ContentPanel uiLang={uiLang} />}
      </div>

      {editor ? (
        <ProductEditor
          mode={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setRefreshKey((key) => key + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function ProductsPanel({
  refreshKey,
  view,
  title,
  emptyTitle,
  emptyBody,
  onEdit,
}: {
  refreshKey: number;
  view: "active" | "archived";
  title: string;
  emptyTitle: string;
  emptyBody: string;
  onEdit: (id: string) => void;
}) {
  const [productRows, setProductRows] = useState<ProductSummary[]>([]);
  const [state, setState] = useState<"loading" | "live" | "fallback">("loading");

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const nextProducts = await getProductSummaries();
        if (!isMounted) return;
        setProductRows(nextProducts);
        setState("live");
      } catch (error) {
        console.error("[Content Studio] Failed to load products", error);
        if (isMounted) setState("fallback");
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const rows = productRows.filter((product) =>
    view === "archived" ? product.status === "archived" : product.status !== "archived",
  );

  return (
    <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
        <span>{title}</span> · {rows.length} · <span>{state === "loading" ? "syncing" : state}</span>
      </div>
      {state !== "loading" && rows.length === 0 ? (
        <GlassCard tone="pink" className="mt-6 p-8 text-center">
          <div className="font-hand text-3xl text-[var(--brand-magenta)]">{emptyTitle}</div>
          <p className="mt-2 text-sm text-foreground/55">
            {emptyBody}
          </p>
        </GlassCard>
      ) : null}
      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((release) => (
          <GlassCard key={release.id} className="group overflow-hidden p-0">
            <button
              onClick={() => onEdit(release.id)}
              className="absolute right-4 top-4 z-10 rounded-full bg-background/80 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.25em] opacity-0 shadow transition hover:bg-[var(--brand-pink)] group-hover:opacity-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onEdit(release.id)}
              className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-magenta)]"
              aria-label={`Edit ${release.name}`}
              title="Edit product"
            >
              <img
                src={release.editorial_image_url ?? release.image_url ?? ""}
                alt={release.name}
                className="aspect-[3/4] w-full bg-[var(--brand-pink)] object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            </button>
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                {release.category ?? "General"}
              </div>
              <h3 className="mt-1 font-display text-2xl leading-tight">{release.name}</h3>
              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-[var(--brand-magenta)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white">
                  {release.status}
                </span>
                <span className="font-hand text-lg text-[var(--brand-magenta)]">
                  {release.handwritten_note ?? "new drop"}
                </span>
              </div>
              {release.featured_on_landing ? (
                <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
                  featured on landing
                </div>
              ) : null}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

const emptyProduct = (): ProductReleaseInput => ({
  id: makeProductId(),
  name: "",
  category: "",
  short_description: "",
  long_description: "",
  handwritten_note: "",
  blogging_recommendations: "",
  editorial_image_url: null,
  image_url: null,
  vendor_poster_url: null,
  second_life_link: "",
  marketplace_link: "",
  release_date: new Date().toISOString().slice(0, 10),
  deadline_at: "",
  blogging_deadline_days: 30,
  status: "draft",
  featured_on_landing: false,
  display_order: 0,
  delivery_item_key: "",
  auto_archive_at: "",
});

function productToInput(product: ProductRelease): ProductReleaseInput {
  return {
    id: product.id,
    name: product.name,
    category: product.category ?? "",
    short_description: product.short_description ?? "",
    long_description: product.long_description ?? "",
    handwritten_note: product.handwritten_note ?? "",
    blogging_recommendations: product.blogging_recommendations ?? "",
    editorial_image_url: product.editorial_image_url,
    image_url: product.image_url,
    vendor_poster_url: product.vendor_poster_url,
    second_life_link: product.second_life_link ?? "",
    marketplace_link: product.marketplace_link ?? "",
    release_date: product.release_date,
    deadline_at: toDateInput(product.deadline_at),
    blogging_deadline_days: product.blogging_deadline_days,
    status: product.status,
    featured_on_landing: product.featured_on_landing,
    display_order: product.display_order,
    delivery_item_key: product.delivery_item_key ?? "",
    auto_archive_at: toDateInput(product.auto_archive_at),
  };
}

type ProductPhotoDraft = {
  key: string;
  id?: string;
  imageUrl: string;
  file?: File;
  fileName?: string;
  isExisting: boolean;
  sortOrder: number;
};

function ProductEditor({
  mode,
  onClose,
  onSaved,
}: {
  mode: EditorMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductReleaseInput>(emptyProduct);
  const [photos, setPhotos] = useState<ProductPhotoDraft[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [vendorFile, setVendorFile] = useState<File | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "deleting">(
    mode.type === "edit" ? "loading" : "ready",
  );
  const [message, setMessage] = useState("");
  const [initialStatus, setInitialStatus] = useState<ProductStatus | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (mode.type !== "edit") return;
      try {
        const [product, galleryImages] = await Promise.all([
          getProductRelease(mode.id),
          listProductReleaseImages(mode.id),
        ]);
        if (isMounted) {
          const coverUrl = product.editorial_image_url ?? product.image_url;
          const nextPhotos = galleryImages.map<ProductPhotoDraft>((image, index) => ({
            key: `existing:${image.id}`,
            id: image.id,
            imageUrl: image.image_url,
            isExisting: true,
            sortOrder: image.sort_order ?? index,
          }));

          if (coverUrl && !nextPhotos.some((image) => image.imageUrl === coverUrl)) {
            nextPhotos.unshift({
              key: `legacy-cover:${coverUrl}`,
              imageUrl: coverUrl,
              isExisting: true,
              sortOrder: -1,
            });
          }

          setForm(productToInput(product));
          setPhotos(nextPhotos);
          setCoverKey(
            nextPhotos.find((image) => image.imageUrl === coverUrl)?.key ??
              nextPhotos.find((image) => galleryImages.some((gallery) => gallery.is_cover && gallery.image_url === image.imageUrl))?.key ??
              nextPhotos[0]?.key ??
              null,
          );
          setInitialStatus(product.status);
          setState("ready");
        }
      } catch (error) {
        console.error("[Content Studio] Failed to load product", error);
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Could not load product.");
          setState("ready");
        }
      }
    }

    void loadProduct();

    return () => {
      isMounted = false;
    };
  }, [mode]);

  function update<K extends keyof ProductReleaseInput>(key: K, value: ProductReleaseInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addPhotos(fileList: FileList | null) {
    const selectedFiles = Array.from(fileList ?? []);
    if (selectedFiles.length === 0) return;

    setPhotos((current) => {
      const nextPhotos = [
        ...current,
        ...selectedFiles.map<ProductPhotoDraft>((file, index) => ({
          key: `new:${Date.now()}:${index}:${file.name}`,
          imageUrl: URL.createObjectURL(file),
          file,
          fileName: file.name,
          isExisting: false,
          sortOrder: current.length + index,
        })),
      ];

      if (!coverKey && nextPhotos.length > 0) {
        setCoverKey(nextPhotos[0].key);
      }

      return nextPhotos;
    });
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const nextPhotos = current.filter((photo) => photo.key !== key);
      if (coverKey === key) {
        setCoverKey(nextPhotos[0]?.key ?? null);
      }
      return nextPhotos;
    });
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const productId = form.id ?? makeProductId();
      let vendorUrl = form.vendor_poster_url;

      if (vendorFile) {
        vendorUrl = await uploadProductImage(productId, "vendor", vendorFile);
      }

      const uploadedPhotos: ProductPhotoDraft[] = [];
      for (const [index, photo] of photos.entries()) {
        if (photo.file) {
          const imageUrl = await uploadProductImage(productId, "gallery", photo.file);
          uploadedPhotos.push({
            ...photo,
            imageUrl,
            file: undefined,
            fileName: undefined,
            sortOrder: index,
          });
        } else {
          uploadedPhotos.push({ ...photo, sortOrder: index });
        }
      }

      const selectedCover =
        uploadedPhotos.find((photo) => photo.key === coverKey) ??
        uploadedPhotos[0] ??
        null;
      const coverUrl = selectedCover?.imageUrl ?? form.editorial_image_url ?? form.image_url ?? null;

      const savedProduct = await upsertProductRelease({
        ...form,
        id: productId,
        editorial_image_url: coverUrl,
        image_url: coverUrl,
        vendor_poster_url: vendorUrl,
        deadline_at: null,
        blogging_deadline_days: form.blogging_deadline_days,
        auto_archive_at: form.auto_archive_at
          ? dateToTimestamptz(form.auto_archive_at)
          : form.release_date
            ? dateToTimestamptz(addDays(form.release_date, 90))
            : null,
        category: emptyToNull(form.category),
        short_description: emptyToNull(form.short_description),
        long_description: emptyToNull(form.long_description),
        handwritten_note: emptyToNull(form.handwritten_note),
        blogging_recommendations: emptyToNull(form.blogging_recommendations),
        second_life_link: emptyToNull(form.second_life_link),
        marketplace_link: emptyToNull(form.marketplace_link),
        delivery_item_key: emptyToNull(form.delivery_item_key),
      });

      await replaceProductReleaseImages(
        productId,
        uploadedPhotos.map((photo, index) => ({
          image_url: photo.imageUrl,
          alt_text: `${form.name || "Product"} photo ${index + 1}`,
          is_cover: photo.key === (selectedCover?.key ?? coverKey),
          sort_order: index,
        })),
      );

      const becameAvailable =
        savedProduct.status === "available" &&
        (mode.type === "create" || initialStatus !== "available");

      if (becameAvailable) {
        void notifyActiveBloggersOfNewProduct(savedProduct);
      }

      onSaved();
    } catch (error) {
      console.error("[Content Studio] Save failed", error);
      setMessage(error instanceof Error ? error.message : "Could not save product.");
      setState("ready");
    }
  }

  async function archiveProduct() {
    if (!form.id) return;
    setState("deleting");
    setMessage("");
    try {
      await archiveProductRelease(form.id);
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not archive product.");
      setState("ready");
    }
  }

  async function deleteProduct() {
    if (!form.id) return;
    const confirmed = window.confirm(
      "Delete this product forever? This also removes its test claims, submitted links, and review history.",
    );
    if (!confirmed) return;
    setState("deleting");
    setMessage("");
    try {
      await deleteProductRelease(form.id);
      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${error.message}. If this is a live public product, use Archive instead.`
          : "Could not delete product.",
      );
      setState("ready");
    }
  }

  const handwrittenPreview = form.handwritten_note?.trim() || "your note";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/55 px-4 py-8 backdrop-blur-sm">
      <form
        onSubmit={saveProduct}
        className="mx-auto max-w-6xl rounded-[2rem] border border-[var(--brand-pink)] bg-background p-6 shadow-2xl md:p-10"
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              Release · {mode.type === "create" ? "creator" : "editor"}
            </div>
            <h2 className="mt-2 font-display text-5xl leading-none">
              {mode.type === "create" ? "Design a new drop." : "Refine the piece."}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {mode.type === "edit" ? (
              <>
                <button
                  type="button"
                  onClick={archiveProduct}
                  disabled={state === "deleting"}
                  className="rounded-full border border-foreground/20 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-[var(--brand-pink)]"
                >
                  <Archive className="mr-2 inline h-4 w-4" />
                  Archive
                </button>
                <button
                  type="button"
                  onClick={deleteProduct}
                  disabled={state === "deleting"}
                  className="rounded-full border border-red-200 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 inline h-4 w-4" />
                  Delete
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-foreground/20 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em]"
            >
              Close
            </button>
          </div>
        </div>

        {state === "loading" ? (
          <div className="mt-12 rounded-3xl border border-dashed border-foreground/15 p-12 text-center font-hand text-3xl text-[var(--brand-magenta)]">
            loading the spell...
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <ProductPhotosPicker
                photos={photos}
                coverKey={coverKey}
                onAdd={addPhotos}
                onCoverChange={setCoverKey}
                onRemove={removePhoto}
              />
              <ImagePicker
                label="Vendor poster"
                helper="Official Second Life vendor. Converted to WebP and available for bloggers to download."
                imageUrl={form.vendor_poster_url}
                file={vendorFile}
                onChange={setVendorFile}
              />
            </div>

            <div className="grid gap-5">
              <Field label="Product name">
                <input
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  required
                  className={inputClass}
                  placeholder="Zenith Top"
                />
              </Field>
              <Field label="Short description">
                <input
                  value={form.short_description ?? ""}
                  onChange={(event) => update("short_description", event.target.value)}
                  className={inputClass}
                  placeholder="Shown on cards and landing."
                />
              </Field>
              <Field label="Full dossier description">
                <textarea
                  rows={4}
                  value={form.long_description ?? ""}
                  onChange={(event) => update("long_description", event.target.value)}
                  className={textareaClass}
                  placeholder="Describe the mood, textures, and soul of the release..."
                />
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Handwritten note">
                  <input
                    value={form.handwritten_note ?? ""}
                    onChange={(event) => update("handwritten_note", event.target.value)}
                    onInput={(event) => update("handwritten_note", event.currentTarget.value)}
                    className={inputClass}
                    placeholder="So chic!"
                  />
                </Field>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
                    Preview
                  </div>
                  <div className="mt-2 min-h-12 rounded-2xl bg-[var(--brand-pink)]/50 px-4 py-2 font-hand text-3xl text-[var(--brand-magenta)]">
                    {handwrittenPreview}
                  </div>
                </div>
              </div>
              <Field label="Blogging recommendations">
                <textarea
                  rows={3}
                  value={form.blogging_recommendations ?? ""}
                  onChange={(event) => update("blogging_recommendations", event.target.value)}
                  className={textareaClass}
                  placeholder="Instructions bloggers see inside the modal."
                />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="SL / Location URL">
                  <input
                    value={form.second_life_link ?? ""}
                    onChange={(event) => update("second_life_link", event.target.value)}
                    className={inputClass}
                    placeholder="secondlife://..."
                  />
                </Field>
                <Field label="Marketplace URL">
                  <input
                    value={form.marketplace_link ?? ""}
                    onChange={(event) => update("marketplace_link", event.target.value)}
                    className={inputClass}
                    placeholder="https://marketplace..."
                  />
                </Field>
                <Field label="Category">
                  <input
                    value={form.category ?? ""}
                    onChange={(event) => update("category", event.target.value)}
                    className={inputClass}
                    placeholder="Couture"
                  />
                </Field>
                <Field
                  label="Second Life product ID"
                  helper="Use the exact inventory item or folder name inside the Love Potion delivery object. This is what the Claim button sends to Second Life."
                >
                  <input
                    value={form.delivery_item_key ?? ""}
                    onChange={(event) => update("delivery_item_key", event.target.value)}
                    className={inputClass}
                    placeholder="e.g. Holiday Magic Gown - Blogger Pack"
                  />
                </Field>
                <Field label="Release date">
                  <input
                    type="date"
                    value={form.release_date ?? ""}
                    onChange={(event) => update("release_date", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Blogger deadline"
                  helper="Starts counting when a blogger claims this product. Product auto-archive still follows the 90-day rule."
                >
                  <select
                    value={form.blogging_deadline_days ?? ""}
                    onChange={(event) =>
                      update(
                        "blogging_deadline_days",
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">No deadline</option>
                    <option value="10">10 days after claim</option>
                    <option value="15">15 days after claim</option>
                    <option value="30">30 days after claim</option>
                  </select>
                </Field>
                <Field label="Release status">
                  <select
                    value={form.status}
                    onChange={(event) => update("status", event.target.value as ProductStatus)}
                    className={inputClass}
                  >
                    <option value="draft">Draft</option>
                    <option value="available">Available (Published)</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Display order">
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(event) => update("display_order", Number(event.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4">
                <input
                  type="checkbox"
                  checked={form.featured_on_landing}
                  onChange={(event) => update("featured_on_landing", event.target.checked)}
                  className="h-5 w-5 accent-[var(--brand-magenta)]"
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
                  Feature on landing page
                </span>
              </label>

              {message ? (
                <div className="rounded-2xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)] p-4 text-sm text-[var(--brand-magenta)]">
                  {message}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t border-foreground/10 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-foreground/20 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em]"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={state === "saving" || state === "loading" || !form.name.trim()}
            className="rounded-full bg-foreground px-7 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background shadow-lg hover:bg-[var(--brand-magenta)] disabled:cursor-wait disabled:opacity-60"
          >
            <Save className="mr-2 inline h-4 w-4" />
            {state === "saving" ? "Saving..." : mode.type === "create" ? "Publish release" : "Update release"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductPhotosPicker({
  photos,
  coverKey,
  onAdd,
  onCoverChange,
  onRemove,
}: {
  photos: ProductPhotoDraft[];
  coverKey: string | null;
  onAdd: (files: FileList | null) => void;
  onCoverChange: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="block">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
            Product photos
          </div>
          <p className="mt-2 text-sm text-foreground/55">
            Add multiple images and choose one cover. The cover appears on the landing page, product cards, and blogger dashboard.
          </p>
        </div>
        <label className="shrink-0 cursor-pointer rounded-full bg-[var(--brand-magenta)] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.25em] text-white shadow-lg shadow-[var(--brand-magenta)]/15 hover:opacity-90">
          <ImagePlus className="mr-2 inline h-4 w-4" />
          Add photos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              onAdd(event.target.files);
              event.currentTarget.value = "";
            }}
            className="sr-only"
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <label className="mt-4 block cursor-pointer overflow-hidden rounded-3xl border border-dashed border-foreground/20 bg-foreground/[0.03]">
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 text-foreground/45">
            <ImagePlus className="h-9 w-9" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Select product photos</span>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              onAdd(event.target.files);
              event.currentTarget.value = "";
            }}
            className="sr-only"
          />
        </label>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {photos.map((photo, index) => {
            const isCover = photo.key === coverKey;
            return (
              <div
                key={photo.key}
                className={`group relative overflow-hidden rounded-3xl border bg-foreground/[0.03] ${
                  isCover ? "border-[var(--brand-magenta)] ring-2 ring-[var(--brand-magenta)]/20" : "border-foreground/10"
                }`}
              >
                <img src={photo.imageUrl} alt={photo.fileName ?? `Product photo ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
                <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onCoverChange(photo.key)}
                    className={`rounded-full px-3 py-2 font-mono text-[8px] uppercase tracking-[0.2em] shadow ${
                      isCover
                        ? "bg-[var(--brand-magenta)] text-white"
                        : "bg-background/85 text-foreground hover:bg-[var(--brand-pink)]"
                    }`}
                  >
                    {isCover ? (
                      <>
                        <Check className="mr-1 inline h-3 w-3" />
                        Cover
                      </>
                    ) : (
                      <>
                        <Star className="mr-1 inline h-3 w-3" />
                        Make cover
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(photo.key)}
                    className="rounded-full bg-background/85 p-2 text-foreground shadow hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="absolute inset-x-2 bottom-2 rounded-full bg-background/85 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.2em] text-foreground/55 shadow">
                  Photo {index + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/40">
        Converted to WebP, 1200x1600, 3:4 vertical.
      </div>
    </div>
  );
}

function ImagePicker({
  label,
  helper,
  imageUrl,
  file,
  onChange,
}: {
  label: string;
  helper: string;
  imageUrl: string | null | undefined;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const previewUrl = file ? URL.createObjectURL(file) : imageUrl;

  return (
    <label className="block">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
        {label}
      </div>
      <div className="mt-2 overflow-hidden rounded-3xl border border-dashed border-foreground/20 bg-foreground/[0.03]">
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="aspect-[3/4] w-full object-cover" />
        ) : (
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 text-foreground/45">
            <ImagePlus className="h-9 w-9" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Select image</span>
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/40">
        {file ? file.name : helper}
      </div>
    </label>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {helper ? (
        <div className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.22em] text-foreground/40">
          {helper}
        </div>
      ) : null}
    </label>
  );
}

type SiteAssetSlot = {
  key: SiteAssetKey;
  label: string;
  description: string;
  fallbackUrl: string;
  ratio: string;
};

const siteAssetSlots: SiteAssetSlot[] = [
  {
    key: "landing_hero",
    label: "Landing hero",
    description: "Main image on the public home page.",
    fallbackUrl: heroImg,
    ratio: "aspect-[4/5]",
  },
  {
    key: "login_editorial",
    label: "Login editorial",
    description: "Large image beside the login form.",
    fallbackUrl: loginImg,
    ratio: "aspect-[4/5]",
  },
  {
    key: "about_editorial",
    label: "About editorial",
    description: "Image on the About page.",
    fallbackUrl: aboutImg,
    ratio: "aspect-[4/3]",
  },
  {
    key: "newsletter_preview",
    label: "Newsletter preview",
    description: "Preview card on the newsletter signup page.",
    fallbackUrl: release2,
    ratio: "aspect-[4/3]",
  },
  {
    key: "logo_icon",
    label: "Public logo icon",
    description: "Small icon in the public navigation bar.",
    fallbackUrl: logoIcon,
    ratio: "aspect-square",
  },
];

function AssetsPanel() {
  const [assets, setAssets] = useState<Record<string, SiteAsset>>({});
  const [files, setFiles] = useState<Partial<Record<SiteAssetKey, File>>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [savingKey, setSavingKey] = useState<SiteAssetKey | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadAssets() {
      try {
        const assetMap = await getSiteAssetMap();
        if (!isMounted) return;
        setAssets(Object.fromEntries(assetMap));
        setState("ready");
      } catch (error) {
        console.error("[Content Studio] Failed to load site assets", error);
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : "Could not load site assets.");
        setState("error");
      }
    }

    void loadAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  async function saveAsset(slot: SiteAssetSlot) {
    const file = files[slot.key];
    if (!file) {
      setMessage("Choose an image before saving.");
      return;
    }

    setSavingKey(slot.key);
    setMessage("");

    try {
      const imageUrl = await uploadSiteAssetImage(slot.key, file);
      const savedAsset = await upsertSiteAsset({
        key: slot.key,
        label: slot.label,
        description: slot.description,
        imageUrl,
      });

      setAssets((current) => ({ ...current, [slot.key]: savedAsset }));
      setFiles((current) => {
        const next = { ...current };
        delete next[slot.key];
        return next;
      });
      setMessage(`${slot.label} updated.`);
      setState("ready");
    } catch (error) {
      console.error("[Content Studio] Failed to save site asset", error);
      setMessage(error instanceof Error ? error.message : "Could not save image.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
            <span>Site images</span> · <span>{state === "loading" ? "syncing" : state}</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-foreground/60">
            Swap the live images used by the public site. The original files remain as fallback.
          </p>
        </div>
        {message ? (
          <div className="rounded-full border border-[var(--brand-pink)] bg-background px-5 py-3 text-sm text-foreground/70">
            {message}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {siteAssetSlots.map((slot) => (
          <AssetSlotCard
            key={slot.key}
            slot={slot}
            asset={assets[slot.key]}
            file={files[slot.key] ?? null}
            isSaving={savingKey === slot.key}
            onFileChange={(file) => setFiles((current) => ({ ...current, [slot.key]: file ?? undefined }))}
            onSave={() => void saveAsset(slot)}
          />
        ))}
      </div>
    </div>
  );
}

function AssetSlotCard({
  slot,
  asset,
  file,
  isSaving,
  onFileChange,
  onSave,
}: {
  slot: SiteAssetSlot;
  asset: SiteAsset | undefined;
  file: File | null;
  isSaving: boolean;
  onFileChange: (file: File | null) => void;
  onSave: () => void;
}) {
  const previewUrl = file ? URL.createObjectURL(file) : asset?.image_url ?? slot.fallbackUrl;

  return (
    <GlassCard tone="pink" className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
            Asset slot
          </div>
          <h3 className="mt-2 font-display text-3xl leading-none">{slot.label}</h3>
        </div>
        <span className="rounded-full bg-background/70 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/45">
          {asset ? "live" : "fallback"}
        </span>
      </div>

      <p className="mt-3 min-h-10 text-sm text-foreground/60">{slot.description}</p>

      <label className="mt-5 block cursor-pointer">
        <div className={`overflow-hidden rounded-2xl border border-dashed border-foreground/20 bg-background/60 ${slot.ratio}`}>
          <img src={previewUrl} alt={slot.label} className="h-full w-full object-cover" />
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <div className="mt-3 rounded-full border border-foreground/15 px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.3em] hover:bg-background/70">
          <ImagePlus className="mr-2 inline h-4 w-4" />
          {file ? file.name : "Choose image"}
        </div>
      </label>

      <button
        type="button"
        onClick={onSave}
        disabled={!file || isSaving}
        className="mt-4 rounded-full bg-foreground px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Save className="mr-2 inline h-4 w-4" />
        {isSaving ? "Saving..." : "Save image"}
      </button>
    </GlassCard>
  );
}

type ContentField = {
  key: string;
  label: string;
  type?: "short" | "long";
};

type ContentSection = {
  id: string;
  title: string;
  description: string;
  fields: ContentField[];
};

const contentSections: ContentSection[] = [
  {
    id: "landing",
    title: "Landing page",
    description: "Hero headlines, handwritten note, intro copy, and primary buttons.",
    fields: [
      { key: "hero_headline_top", label: "Hero headline top" },
      { key: "hero_headline_bottom", label: "Hero headline bottom" },
      { key: "hero_kicker", label: "Vertical kicker" },
      { key: "hero_handwritten", label: "Handwritten note" },
      { key: "hero_sub", label: "Hero paragraph", type: "long" },
      { key: "hero_cta_blogger", label: "Blogger button" },
      { key: "hero_cta_apply", label: "Apply button" },
    ],
  },
  {
    id: "about",
    title: "About page",
    description: "Manifesto title, body copy, and pull quote.",
    fields: [
      { key: "about_kicker", label: "Kicker" },
      { key: "about_title", label: "Title" },
      { key: "about_body1", label: "Main paragraph", type: "long" },
      { key: "about_body2", label: "Second paragraph", type: "long" },
      { key: "about_pull", label: "Pull quote" },
    ],
  },
  {
    id: "shop",
    title: "Shop info",
    description: "Where-to-find-us page details and buying message.",
    fields: [
      { key: "shop_title", label: "Title" },
      { key: "shop_copy", label: "Intro copy", type: "long" },
      { key: "shop_mainstore", label: "Mainstore label" },
      { key: "shop_mainstore_val", label: "Mainstore value" },
      { key: "shop_mp", label: "Marketplace label" },
      { key: "shop_mp_val", label: "Marketplace value" },
      { key: "shop_group", label: "Group gift label" },
      { key: "shop_group_val", label: "Group gift value" },
      { key: "shop_handwritten", label: "Handwritten note" },
    ],
  },
  {
    id: "newsletter",
    title: "Newsletter page",
    description: "Signup page copy and preview card text.",
    fields: [
      { key: "newsletter_title", label: "Title" },
      { key: "newsletter_kicker", label: "Intro copy", type: "long" },
      { key: "newsletter_placeholder", label: "Input label" },
      { key: "newsletter_cta", label: "Button text" },
      { key: "newsletter_preview", label: "Preview label" },
      { key: "newsletter_sample_title", label: "Preview title" },
      { key: "newsletter_sample_body", label: "Preview body", type: "long" },
    ],
  },
];

function getDefaultContent(language: Lang): Record<string, string> {
  const t = dict[language];
  return {
    hero_headline_top: t.hero.headline_top,
    hero_headline_bottom: t.hero.headline_bottom,
    hero_kicker: t.hero.kicker,
    hero_handwritten: t.hero.handwritten,
    hero_sub: t.hero.sub,
    hero_cta_blogger: t.hero.ctaBlogger,
    hero_cta_apply: t.hero.ctaApply,
    about_kicker: t.about.kicker,
    about_title: t.about.title,
    about_body1: t.about.body1,
    about_body2: t.about.body2,
    about_pull: t.about.pull,
    shop_title: t.shop.title,
    shop_copy: t.shop.copy,
    shop_mainstore: t.shop.mainstore,
    shop_mainstore_val: t.shop.mainstoreVal,
    shop_mp: t.shop.mp,
    shop_mp_val: t.shop.mpVal,
    shop_group: t.shop.group,
    shop_group_val: t.shop.groupVal,
    shop_handwritten: language === "es" ? "prueba el demo primero" : "try the demo first",
    newsletter_title: t.newsletter.title,
    newsletter_kicker: t.newsletter.kicker,
    newsletter_placeholder: t.newsletter.placeholder,
    newsletter_cta: t.newsletter.cta,
    newsletter_preview: t.newsletter.preview,
    newsletter_sample_title: t.newsletter.sampleTitle,
    newsletter_sample_body: t.newsletter.sampleBody,
  };
}

function ContentPanel({ uiLang }: { uiLang: Lang }) {
  const [language, setLanguage] = useState<Lang>(uiLang);
  const [drafts, setDrafts] = useState<Record<Lang, Record<string, string>>>({
    en: getDefaultContent("en"),
    es: getDefaultContent("es"),
  });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLanguage(uiLang);
  }, [uiLang]);

  useEffect(() => {
    let isMounted = true;

    async function loadContent() {
      try {
        const [enRows, esRows] = await Promise.all([listSiteContent("en"), listSiteContent("es")]);
        if (!isMounted) return;
        setDrafts({
          en: { ...getDefaultContent("en"), ...Object.fromEntries(enRows.map((row) => [row.key, row.value])) },
          es: { ...getDefaultContent("es"), ...Object.fromEntries(esRows.map((row) => [row.key, row.value])) },
        });
        setState("ready");
      } catch (error) {
        console.error("[Content Studio] Failed to load site content", error);
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : "Could not load site content.");
        setState("error");
      }
    }

    void loadContent();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateDraft(key: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [language]: {
        ...current[language],
        [key]: value,
      },
    }));
  }

  async function saveSection(section: ContentSection) {
    setSavingSection(section.id);
    setMessage("");

    try {
      await upsertSiteContent(
        section.fields.map((field) => ({
          key: field.key,
          language,
          label: field.label,
          value: drafts[language][field.key] ?? "",
        })),
      );
      setMessage(`${section.title} saved for ${language.toUpperCase()}.`);
      setState("ready");
    } catch (error) {
      console.error("[Content Studio] Failed to save site content", error);
      setMessage(error instanceof Error ? error.message : "Could not save content.");
    } finally {
      setSavingSection(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
            <span>Site copy</span> · <span>{state === "loading" ? "syncing" : state}</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-foreground/60">
            Edit public site text by language. Saved fields override the built-in copy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-foreground/15 bg-background p-1">
            {(["en", "es"] as Lang[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLanguage(item)}
                className={`rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] ${
                  language === item ? "bg-foreground text-background" : "text-foreground/55"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {message ? (
            <div className="rounded-full border border-[var(--brand-pink)] bg-background px-5 py-3 text-sm text-foreground/70">
              {message}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {contentSections.map((section) => (
          <GlassCard key={section.id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                  <span>Content block</span>
                </div>
                <h3 className="mt-2 font-display text-3xl leading-none">
                  <span>{section.title}</span>
                </h3>
                <p className="mt-3 text-sm text-foreground/60">
                  <span>{section.description}</span>
                </p>
              </div>
              <span className="rounded-full bg-[var(--brand-pink)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--brand-magenta)]">
                {language}
              </span>
            </div>

            <div className="mt-6 grid gap-4">
              {section.fields.map((field) => (
                <Field key={field.key} label={field.label}>
                  {field.type === "long" ? (
                    <textarea
                      rows={4}
                      value={drafts[language][field.key] ?? ""}
                      onChange={(event) => updateDraft(field.key, event.target.value)}
                      className={textareaClass}
                    />
                  ) : (
                    <input
                      value={drafts[language][field.key] ?? ""}
                      onChange={(event) => updateDraft(field.key, event.target.value)}
                      className={inputClass}
                    />
                  )}
                </Field>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void saveSection(section)}
              disabled={savingSection === section.id}
              className="mt-6 w-full rounded-full bg-foreground px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-wait disabled:opacity-60"
            >
              <Save className="mr-2 inline h-4 w-4" />
              {savingSection === section.id ? (
                "Saving..."
              ) : (
                <>
                  <span>Save</span> <span>{section.title}</span>
                </>
              )}
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-foreground/15 bg-background/70 px-5 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)]";

const textareaClass =
  "w-full rounded-2xl border border-foreground/15 bg-background/70 px-5 py-3 text-sm outline-none transition focus:border-[var(--brand-magenta)]";

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function dateToTimestamptz(value: string) {
  return new Date(`${value}T23:59:00`).toISOString();
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function notifyActiveBloggersOfNewProduct(product: ProductRelease) {
  try {
    const bloggers = await listBloggers();
    const activeBloggers = bloggers.filter((blogger) => blogger.account_status === "active");
    const deadline = product.deadline_at ? toDateInput(product.deadline_at) : null;

    activeBloggers.forEach((blogger) => {
      void notifySecondLifeQuietly(
        {
          recipientId: blogger.id,
          type: "new_product",
          title: `New product: ${product.name}`,
          body: deadline
            ? `${product.name} is ready to claim. Blogger deadline: ${deadline}.`
            : `${product.name} is ready to claim in your Love Potion dashboard.`,
        },
        "New product notification",
      );
    });
  } catch (error) {
    console.warn("[New product notification] skipped", error);
  }
}
