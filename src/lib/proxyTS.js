import https from "node:https";
import http from "node:http";
import path from "node:path";

export async function proxyTs(url, headers, req, res) {
  // 0) Derive a filename for this .ts segment
  let tsName = path.basename(new URL(url).pathname) || "segmentResponse.ts";
  if (!tsName.endsWith(".ts")) {
    tsName = "segmentResponse.ts";
  }

  // 1) Determine protocol
  const forceHTTPS = url.startsWith("https://");
  const uri = new URL(url);
  const options = {
    hostname: uri.hostname,
    port: uri.port,
    path: uri.pathname + uri.search,
    method: req.method,
    headers: {
      "Referer": "https://www.youtube.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
      ...headers,
    },
  };

  // 2) CORS & disposition
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Content-Disposition", `inline; filename="${tsName}"`);

  try {
    const proxyLib = forceHTTPS ? https : http;
    const proxyReq = proxyLib.request(options, (r) => {
      // force the right content type
      r.headers["content-type"] = "video/mp2t";
      // mirror status & headers
      res.writeHead(r.statusCode ?? 200, r.headers);
      // pipe the bytes
      r.pipe(res, { end: true });
    });
    // pipe client request to upstream
    req.pipe(proxyReq, { end: true });
  } catch (e) {
    res.writeHead(500);
    res.end(e.message);
    return null;
  }
}
