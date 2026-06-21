import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
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
  const filePath = safeStaticPath(pathname);
  if (!filePath) return false;

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) return false;

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

    if (await serveStaticFile(request, response, url.pathname)) return;

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
