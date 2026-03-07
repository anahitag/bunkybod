import http from "http";
import https from "https";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) { console.error("Set GITHUB_TOKEN env var"); process.exit(1); }
const PORT = 4001;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    // Forward to GitHub Models
    const options = {
      hostname: "models.github.ai",
      port: 443,
      path: "/inference" + (req.url || "/chat/completions"),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    };

    const proxy = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxy.on("error", (e) => {
      console.error("Proxy error:", e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    });

    proxy.write(body);
    proxy.end();
  });
});

server.listen(PORT, () => {
  console.log(`AI Proxy running on http://localhost:${PORT}`);
  console.log("Expose with: npx ngrok http 4001 --domain ron-unsacramental-discourteously.ngrok-free.dev");
  console.log("Then set AI_PROXY_URL on Vercel to the ngrok URL");
});
