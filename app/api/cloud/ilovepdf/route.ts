import { json, rateLimited, sameSite } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The tools the site uses; anything else is refused.
const TOOLS = new Set(["officepdf", "pdfocr", "repair", "compress"]);

/**
 * Starts an iLovePDF task and hands the browser a token scoped to it, so the
 * file can be uploaded straight to iLovePDF (no size limit from our server).
 */
export async function POST(req: Request) {
  if (!sameSite(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(req)) return json({ error: "rate_limited" }, 429);
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  if (!publicKey) return json({ error: "not_configured" }, 503);

  const { tool } = (await req.json().catch(() => ({}))) as { tool?: string };
  if (!tool || !TOOLS.has(tool)) return json({ error: "unknown_tool" }, 400);

  const auth = await fetch("https://api.ilovepdf.com/v1/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicKey }),
    cache: "no-store",
  });
  if (!auth.ok) return json({ error: auth.status === 401 ? "key" : "server" }, 502);
  const { token } = (await auth.json()) as { token: string };

  const start = await fetch(`https://api.ilovepdf.com/v1/start/${tool}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!start.ok) return json({ error: start.status === 402 || start.status === 429 ? "quota" : "server" }, 502);
  const { server, task } = (await start.json()) as { server: string; task: string };
  return json({ token, server, task });
}
