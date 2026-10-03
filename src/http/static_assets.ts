const assetTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

export async function consoleAsset(pathname: string): Promise<Response> {
  const requested = pathname === "/"
    ? "index.html"
    : decodeURIComponent(pathname.slice(1));
  if (requested.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const isAsset = requested.includes(".");
  try {
    const content = await Deno.readFile(
      new URL(`../../web/dist/${requested}`, import.meta.url),
    );
    const extension = requested.slice(requested.lastIndexOf("."));
    return new Response(content, {
      headers: {
        "content-type": assetTypes[extension] ?? "application/octet-stream",
        "cache-control": requested === "index.html"
          ? "no-cache"
          : "public, max-age=31536000, immutable",
      },
    });
  } catch {
    if (isAsset) return new Response("Not found", { status: 404 });
    const index = await Deno.readFile(
      new URL("../../web/dist/index.html", import.meta.url),
    );
    return new Response(index, {
      headers: {
        "content-type": assetTypes[".html"],
        "cache-control": "no-cache",
      },
    });
  }
}
