import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const clientDir = path.join(root, "dist", "client");
const serverEntry = path.join(root, "dist", "server", "server.js");

const routes = [
  "/en",
  "/es",
  "/en/about",
  "/es/about",
  "/en/releases",
  "/es/releases",
  "/en/shop-info",
  "/es/shop-info",
  "/en/links",
  "/es/links",
  "/en/login",
  "/es/login",
  "/en/apply",
  "/es/apply",
];

const server = await import(pathToFileURL(serverEntry).href).then((module) => module.default);

async function writeRuntimeEnv() {
  const payload = {
    VITE_SUPABASE_URL: cleanPublicEnv(process.env.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: cleanPublicEnv(process.env.VITE_SUPABASE_ANON_KEY),
  };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  await writeFile(path.join(clientDir, "env.js"), `window.__LOVE_POTION_ENV__=${json};\n`);
}

function cleanPublicEnv(value) {
  const text = `${value ?? ""}`.trim();
  if (!text || text.includes("your-project-ref") || text.includes("your-supabase-anon-public-key")) {
    return "";
  }
  return text;
}

async function writeClientShell() {
  const serverAssetsDir = path.join(root, "dist", "server", "assets");
  const clientAssetsDir = path.join(clientDir, "assets");
  const [serverAssets, clientAssets] = await Promise.all([
    readdir(serverAssetsDir),
    readdir(clientAssetsDir),
  ]);
  const manifestFile = serverAssets.find(
    (file) => file.startsWith("_tanstack-start-manifest") && file.endsWith(".js"),
  );

  if (!manifestFile) {
    throw new Error("Could not find TanStack client manifest.");
  }

  const manifestUrl = pathToFileURL(path.join(serverAssetsDir, manifestFile)).href;
  const manifestModule = await import(manifestUrl);
  const manifest = manifestModule.tsrStartManifest();
  const rootRoute = manifest.routes.__root__;
  const scriptSrc = rootRoute.scripts?.[0]?.attrs?.src;

  if (!scriptSrc) {
    throw new Error("Could not find Love Potion client script.");
  }

  const stylesheetFile = clientAssets.find((file) => file.startsWith("styles-") && file.endsWith(".css"));
  const stylesheetTag = stylesheetFile
    ? `<link rel="stylesheet" href="/assets/${escapeHtml(stylesheetFile)}" />`
    : "";
  const preloadTags = [...new Set(rootRoute.preloads ?? [])]
    .map((href) => `<link rel="modulepreload" href="${escapeHtml(href)}" />`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Love Potion - Style that casts a spell</title>
    <meta name="description" content="Love Potion - a fashion house for Second Life." />
    ${stylesheetTag}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Caveat:wght@400;600;700&display=swap" />
    ${preloadTags}
  </head>
  <body>
    <script type="module" async src="${escapeHtml(scriptSrc)}"></script>
  </body>
</html>`;

  await writeFile(path.join(clientDir, "index.html"), html);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderRoute(route) {
  const response = await server.fetch(new Request(`http://localhost${route}`), {}, {});
  if (!response.ok && response.status !== 307 && response.status !== 308) {
    throw new Error(`Could not render ${route}: HTTP ${response.status}`);
  }

  if (response.status === 307 || response.status === 308) return null;

  const html = await response.text();
  const outputDir = path.join(clientDir, route.replace(/^\/+/, ""));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "index.html"), html);
  return route;
}

const rendered = [];
for (const route of routes) {
  const result = await renderRoute(route);
  if (result) rendered.push(result);
}

await writeRuntimeEnv();
await writeClientShell();

console.log(`Generated ${rendered.length} static pages for Hostinger.`);
