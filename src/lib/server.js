import dotenv from "dotenv";
import createServer from "./createServer.js";
import colors from "colors";

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

function parseOrigins(envVar) {
  try {
    return JSON.parse(envVar || "[]");
  } catch (e) {
    console.error(colors.red("Invalid ALLOWED_ORIGINS format. It should be a valid JSON array."));
    return [];
  }
}

export default function server() {
  createServer({
    originBlacklist: ["*"],
    originWhitelist: parseOrigins(process.env.ALLOWED_ORIGINS),
    requireHeader: [],
    removeHeaders: [
      "cookie",
      "cookie2",
      "x-request-start",
      "x-request-id",
      "via",
      "connect-time",
      "total-route-time",
    ],
    redirectSameOrigin: true,
    httpProxyOptions: {
      xfwd: false,
    },
  }).listen(port, host, function () {
    console.log(
      colors.green("Server running on ") + colors.blue(`${web_server_url}`)
    );
  });
}
