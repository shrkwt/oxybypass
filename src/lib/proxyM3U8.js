import axios from "axios";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

export default async function proxyM3U8(url, headers, res) {
  // 0) Determine a filename for this manifest
  let manifestName = path.basename(new URL(url).pathname) || "streamResponse.hls";
  if (!manifestName.endsWith(".m3u8")) {
    manifestName = "streamResponse.hls";
  }

  // 1) Fetch original playlist
  const resp = await axios(url, { headers }).catch((err) => {
    res.writeHead(500);
    res.end(err.message);
    return null;
  });
  if (!resp) return;

  // 2) Prepare optional headers param
  const headersParam =
    Object.keys(headers).length > 0
      ? "&headers=" + encodeURIComponent(JSON.stringify(headers))
      : "";

  // 3) Split into lines and set up state
  const lines = resp.data.split("\n");
  const out = [];
  let pendingVariant = false;
  const isMaster = resp.data.includes("RESOLUTION=");

  for (let line of lines) {
    // ** STOP as soon as we hit the end-of-list tag **
    if (line.trim() === "#EXT-X-ENDLIST") {
      out.push(line);
      break;
    }

    // --- Decryption key URLs (master or media) ---
    if (line.startsWith("#EXT-X-KEY:")) {
      const regex = /https?:\/\/[^\s"]+/g;
      const match = regex.exec(line)?.[0] || "";
      const proxied = `${web_server_url}/seg?url=${encodeURIComponent(
        match
      )}${headersParam}`;
      out.push(line.replace(regex, proxied));

    // --- Audio‐media playlists in master ---
    } else if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
      const regex = /https?:\/\/[^\s"]+/g;
      const match = regex.exec(line)?.[0] || "";
      const proxied = `${web_server_url}/hls-proxy?url=${encodeURIComponent(
        match
      )}${headersParam}`;
      out.push(line.replace(regex, proxied));

    // --- Master variant header: next non-blank line is a .m3u8 URI ---
    } else if (isMaster && line.startsWith("#EXT-X-STREAM-INF")) {
      out.push(line);
      pendingVariant = true;

    // --- Rewrite the very next URI after a variant header ---
    } else if (pendingVariant && line.trim() !== "") {
      pendingVariant = false;
      const uri = new URL(line, url);
      if (uri.pathname.endsWith(".m3u8")) {
        // nested master/media playlist
        out.push(
          `${web_server_url}/hls-proxy?url=${encodeURIComponent(
            uri.href
          )}${headersParam}`
        );
      } else {
        // rare case: master listing .ts directly
        out.push(
          `${web_server_url}/seg?url=${encodeURIComponent(
            uri.href
          )}${headersParam}`
        );
      }

    // --- Media‐playlist segment lines (no RESOLUTION=) ---
    } else if (!isMaster && line.trim() !== "" && !line.startsWith("#")) {
      // in a media playlist every non-# line is a .ts segment
      const uri = new URL(line, url);
      out.push(
        `${web_server_url}/seg?url=${encodeURIComponent(
          uri.href
        )}${headersParam}`
      );

    // --- All other lines pass through unchanged ---
    } else {
      out.push(line);
    }
  }

  // 4) Clean upstream headers
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

  // 5) Send it back as an HLS master or media playlist
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  // Use the derived manifestName
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${manifestName}"`
  );
  res.end(out.join("\n"));
}
