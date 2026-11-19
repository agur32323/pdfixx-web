/**
 * Shared checks for the cloud routes: only our own pages may call them, and
 * each address gets a modest number of calls per hour so the conversion
 * quotas can't be drained by scripts.
 */
const ALLOWED_HOSTS = [/^localhost(:\d+)?$/, /^127\.0\.0\.1(:\d+)?$/, /(^|\.)pdfixx-web\.vercel\.app$/, /^pdfixx-web-[\w-]+\.vercel\.app$/, /(^|\.)pdfixx\.(app|com)$/];

export function sameSite(req: Request): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return ALLOWED_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

const hits = new Map<string, number[]>();
const WINDOW = 60 * 60 * 1000;
const LIMIT = 30;

/** Best effort: counts are per server instance. */
export function rateLimited(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT;
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
