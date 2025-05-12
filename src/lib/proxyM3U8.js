import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

export default async function proxyM3U8(url, headers, res) {
  // Fetch the original playlist
  const req = await axios(url, { headers }).catch((err) => {
    res.writeHead(500);
    res.end(err.message);
    return null;
  });
  if (!req) return;

  // Prepare the header‐param only if we actually have headers
  const hasCustomHeaders = Object.keys(headers).length > 0;
  const headersParam = hasCustomHeaders
    ? "&headers=" + encodeURIComponent(JSON.stringify(headers))
    : "";

  // Split into lines
  const lines = req.data.split("\n");
  const newLines = [];
  let pendingVariant = false;

  for (let line of lines) {
    // 1) Rewrite decryption keys
    if (line.startsWith("#EXT-X-KEY:")) {
      const regex = /https?:\/\/[^\s"]+/g;
      const match = regex.exec(line)?.[0] || "";
      const proxied = `${web_server_url}/seg?url=${encodeURIComponent(match)}${headersParam}`;
      newLines.push(line.replace(regex, proxied));

    // 2) Rewrite AUDIO entries
    } else if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
      const regex = /https?:\/\/[^\s"]+/g;
      const match = regex.exec(line)?.[0] || "";
      const proxied = `${web_server_url}/hls-proxy?url=${encodeURIComponent(match)}${headersParam}`;
      newLines.push(line.replace(regex, proxied));

    // 3) On a variant header, emit it and mark the next URI for rewriting
    } else if (line.startsWith("#EXT-X-STREAM-INF")) {
      newLines.push(line);
      pendingVariant = true;

    // 4) The very next non-blank line after a variant header is the URI itself
    } else if (pendingVariant && line.trim() !== "") {
      pendingVariant = false;
      // Resolve relative URIs against the master playlist URL
      const uri = new URL(line, url);
      newLines.push(`${web_server_url}/hls-proxy?url=${encodeURIComponent(uri.href)}${headersParam}`);

    // 5) Everything else (comments, blank lines, etc.) passes through
    } else {
      newLines.push(line);
    }
  }

  // Clean out any unwanted upstream headers
  [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
    "Access-Control-Max-Age",
    "Access-Control-Allow-Credentials",
    "Access-Control-Expose-Headers",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
    "Origin",
    "Vary",
    "Referer",
    "Server",
    "x-cache",
    "via",
    "x-amz-cf-pop",
    "x-amz-cf-id",
  ].forEach((h) => res.removeHeader(h));

  // Set correct response headers
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Content-Disposition", 'inline; filename="streamResponse.hls"');

  // Send the rewritten playlist
  res.end(newLines.join("\n"));
}
