import { createServer } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, "dist", "client");
const serverEntryUrl = pathToFileURL(path.join(__dirname, "dist", "server", "server.js")).href;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

let serverEntryPromise;
let shellAssetsPromise;

function getServerEntry() {
  if (!serverEntryPromise) {
    serverEntryPromise = import(serverEntryUrl).then((module) => module.default ?? module);
  }
  return serverEntryPromise;
}

function safeStaticPath(urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const normalized = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(clientDir, normalized);
  return filePath.startsWith(clientDir) ? filePath : null;
}

async function serveStaticFile(request, response, pathname) {
  let filePath = safeStaticPath(pathname);
  if (!filePath) return false;

  try {
    let fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      const indexStats = await stat(indexPath);
      if (!indexStats.isFile()) return false;
      filePath = indexPath;
      fileStats = indexStats;
    } else if (!fileStats.isFile()) {
      return false;
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
    response.writeHead(200, {
      "content-length": fileStats.size,
      "content-type": contentType,
      "cache-control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=300",
    });

    if (request.method === "HEAD") {
      response.end();
    } else {
      createReadStream(filePath).pipe(response);
    }
    return true;
  } catch {
    return false;
  }
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function serveHealth(response) {
  const payload = {
    ok: true,
    cwd: process.cwd(),
    server_dir: __dirname,
    node: process.version,
    has_dist_client: await pathExists(clientDir),
    has_dist_server: await pathExists(path.join(__dirname, "dist", "server")),
    has_server_entry: await pathExists(path.join(__dirname, "dist", "server", "server.js")),
    has_supabase_url: Boolean(process.env.VITE_SUPABASE_URL),
    has_supabase_key: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
    hostinger_render_mode: "static_pages",
  };

  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function getShellAssets() {
  if (!shellAssetsPromise) {
    shellAssetsPromise = (async () => {
      const serverAssetsDir = path.join(__dirname, "dist", "server", "assets");
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

      return {
        scriptSrc,
        stylesheetHref: `/assets/${clientAssets.find(
          (file) => file.startsWith("styles-") && file.endsWith(".css"),
        )}`,
        preloads: [...new Set(rootRoute.preloads ?? [])],
      };
    })();
  }

  return shellAssetsPromise;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function serveClientShell(request, response) {
  if (!["GET", "HEAD"].includes(request.method ?? "GET")) return false;

  const { scriptSrc, stylesheetHref, preloads } = await getShellAssets();
  const preloadTags = preloads
    .map((href) => `<link rel="modulepreload" href="${escapeHtml(href)}" />`)
    .join("");
  const stylesheetTag = stylesheetHref
    ? `<link rel="stylesheet" href="${escapeHtml(stylesheetHref)}" />`
    : "";

  const body = `<!doctype html>
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

  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });

  response.end(request.method === "HEAD" ? undefined : body);
  return true;
}

async function sendFetchResponse(response, fetchResponse) {
  response.writeHead(
    fetchResponse.status,
    Object.fromEntries(fetchResponse.headers.entries()),
  );

  if (!fetchResponse.body) {
    response.end();
    return;
  }

  response.end(Buffer.from(await fetchResponse.arrayBuffer()));
}

function buildRequest(nodeRequest) {
  const host = nodeRequest.headers.host ?? `127.0.0.1:${process.env.PORT ?? 3000}`;
  const protocol = nodeRequest.headers["x-forwarded-proto"] ?? "https";
  const url = new URL(nodeRequest.url ?? "/", `${protocol}://${host}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(nodeRequest.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const method = nodeRequest.method ?? "GET";
  const hasBody = !["GET", "HEAD"].includes(method);
  return new Request(url, {
    method,
    headers,
    body: hasBody ? nodeRequest : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname === "/__health") {
      await serveHealth(response);
      return;
    }

    if (await serveStaticFile(request, response, url.pathname)) return;

    if (url.pathname === "/") {
      response.writeHead(307, { location: "/en" });
      response.end();
      return;
    }

    if (await serveClientShell(request, response)) return;

    const handler = await getServerEntry();
    const fetchResponse = await handler.fetch(buildRequest(request), {}, {});
    await sendFetchResponse(response, fetchResponse);
  } catch (error) {
    console.error(error);
    const body = await readFile(path.join(clientDir, "500.html"), "utf8").catch(
      () => "Love Potion could not load. Please try again.",
    );
    response.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  }
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

server.listen(port, host, () => {
  console.log(`Love Potion is running on http://${host}:${port}`);
});
