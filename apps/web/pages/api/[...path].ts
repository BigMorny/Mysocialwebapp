import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
  },
};

function getQueryString(req: NextApiRequest) {
  const rawUrl = req.url ?? "";
  const idx = rawUrl.indexOf("?");
  return idx >= 0 ? rawUrl.slice(idx) : "";
}

function copyRequestHeaders(req: NextApiRequest) {
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length") return;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  });
  return headers;
}

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const targetBase = process.env.API_PROXY_TARGET;
  if (!targetBase) {
    return res.status(500).json({ ok: false, error: "API proxy target is not configured." });
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [];
  const path = pathParts.join("/");
  const query = getQueryString(req);
  const targetUrl = `${targetBase.replace(/\/+$/, "")}/${path}${query}`;

  try {
    const method = req.method ?? "GET";
    const headers = copyRequestHeaders(req);
    const body = method === "GET" || method === "HEAD" ? undefined : await readRawBody(req);

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    const setCookie = (upstream.headers as any).getSetCookie?.() as string[] | undefined;
    if (setCookie && setCookie.length > 0) {
      res.setHeader("Set-Cookie", setCookie);
    }

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) res.setHeader("Content-Disposition", contentDisposition);

    const responseBuffer = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(responseBuffer);
  } catch {
    res.status(502).json({ ok: false, error: "API proxy unreachable" });
  }
}

