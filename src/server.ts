import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync } from "fs";
import { join } from "path";
import { processRequest, IncomingRequest } from "./main";
import { logEvent } from "./logger";

const PORT = Number(process.env.PORT ?? 3000);
const INDEX_HTML = join(__dirname, "..", "public", "index.html");

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      try {
        const html = readFileSync(INDEX_HTML);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
      } catch {
        sendJson(res, 500, { error: "frontend not found" });
      }
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { status: "ok", hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
      return;
    }

    if (req.method === "POST" && req.url === "/intake") {
      const raw = await readBody(req);
      let parsed: Partial<IncomingRequest>;
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        sendJson(res, 400, { error: "invalid JSON body" });
        return;
      }
      if (typeof parsed.text !== "string" || parsed.text.trim() === "") {
        sendJson(res, 400, { error: "field 'text' (string) is required" });
        return;
      }
      const request: IncomingRequest = {
        source: parsed.source ?? "api",
        text: parsed.text,
        sender: parsed.sender ?? "unknown@company.de",
        timestamp: parsed.timestamp ?? new Date().toISOString(),
      };
      const result = await processRequest(request);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: "not found", routes: ["GET /", "GET /health", "POST /intake"] });
  } catch (err) {
    logEvent({ event: "server_error", message: err instanceof Error ? err.message : String(err) });
    sendJson(res, 500, { error: "internal error" });
  }
});

server.listen(PORT, () => {
  logEvent({ event: "server_listening", port: PORT, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
  process.stderr.write(
    `Frank Says service desk listening on http://localhost:${PORT}\n` +
      `  GET  /health\n` +
      `  POST /intake   body: { "text": "...", "sender": "user@company.de", "source": "email" }\n`,
  );
});
