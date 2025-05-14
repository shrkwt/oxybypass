import axios from "axios";
import dotenv from "dotenv";
import path from "node:path";
import https from "https";

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

/**
 * Fetch raw HTML from a URL (with a browser-like user-agent).
 */
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; Node.js)" } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        }
      )
      .on("error", (err) => reject(err));
  });
}

/**
 * Scrape the YouTube live page to extract the HLS manifest URL (.m3u8).
 */
async function extractYouTubeM3U8(youtubePageUrl) {
  const html = await fetchHtml(youtubePageUrl);
  const match = html.match(/"hlsManifestUrl":"(https:[^"\\]+\.m3u8)"/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error("Could not extract YouTube .m3u8 manifest URL");
}

/**
 * Proxy function: fetch, rewrite, and serve an HLS playlist.
 * If the input URL is a YouTube live page, scrape for the real .m3u8 first.
 */
export default async function proxyM3U8(url, headers, res) {
  // 1) If YouTube page, extract the real manifest URL
  if (/^https?:\/\/(www\.)?youtube\.com\/.+/.test(url)) {
    try {
      url = await extractYouTubeM3U8(url);
      console.log(`Scraped YouTube manifest: ${url}`);
    } catch (err) {
      res.writeHead(500);
      return res.end(`YouTube extraction error: ${err.message}`);
    }
  }

  // 2) Determine a filename
  let manifestName = path.basename(new URL(url).pathname) || "streamResponse.hls";
  if (!manifestName.endsWith(".m3u8")) {
    manifestName = "streamResponse.hls";
  }

  // 3) Fetch original playlist
  const resp = await axios(url, { headers }).catch((err) => {
    res.writeHead(500);
    res.end(err.message);
    return null;
  });
  if (!resp) return;

  // 4) Prepare headersParam
  const headersParam =
    Object.keys(headers).length > 0
      ? `&headers=${encodeURIComponent(JSON.stringify(headers))}`
      : "";

  // 5) Parse and rewrite lines
  const lines = resp.data.split("\n");
  const out = [];
  let pendingVariant = false;
  const isMaster = resp.data.includes("RESOLUTION=");

  for (let line of lines) {
    if (line.trim() === "#EXT-X-ENDLIST") {
      out.push(line);
      break;
    }

    // Decryption keys
    if (line.startsWith("#EXT-X-KEY:")) {
      const regex = /https?:\/\/[^"]+/g;
      const match = regex.exec(line)?.[0] || "";
      const proxied = `${web_server_url}/seg?url=${encodeURIComponent(match)}${headersParam}`;
      out.push(line.replace(regex, proxied));

    // Audio in master playlist
    } else if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
      const regex = /https?:\/\/[^"]+/g;
      const match = regex.exec(line)?.[0] || "";
      const proxied = `${web_server_url}/hls-proxy?url=${encodeURIComponent(match)}${headersParam}`;
      out.push(line.replace(regex, proxied));

    // Master variant header
    } else if (isMaster && line.startsWith("#EXT-X-STREAM-INF")) {
      out.push(line);
      pendingVariant = true;

    // Next line after variant header
    } else if (pendingVariant && line.trim() !== "") {
      pendingVariant = false;
      const uri = new URL(line, url);
      const proxyPath = uri.pathname.endsWith(".m3u8") ? "/hls-proxy" : "/seg";
      out.push(
        `${web_server_url}${proxyPath}?url=${encodeURIComponent(uri.href)}${headersParam}`
      );

    // Media segment lines
    } else if (!isMaster && line.trim() !== "" && !line.startsWith("#")) {
      const uri = new URL(line, url);
      out.push(
        `${web_server_url}/seg?url=${encodeURIComponent(uri.href)}${headersParam}`
      );

    // Other lines pass through
    } else {
      out.push(line);
    }
  }

  // 6) Clean upstream headers
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

  // 7) Serve back
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Content-Disposition", `inline; filename="${manifestName}"`);
  res.end(out.join("\n"));
}