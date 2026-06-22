import { mkdir, writeFile } from "node:fs/promises";
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
  "/app",
  "/app/atelier",
  "/app/blogger",
  "/app/bloggers",
  "/app/applications",
  "/app/admin",
  "/app/files-links",
  "/app/content-studio",
  "/app/managers",
  "/app/audit-log",
  "/app/profile",
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

console.log(`Generated ${rendered.length} static pages for Hostinger.`);
