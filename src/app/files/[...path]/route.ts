import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, MIME_BY_EXT } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const full = path.resolve(UPLOAD_DIR, ...parts);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(full);
    const type = MIME_BY_EXT[path.extname(full).toLowerCase()] ?? "application/octet-stream";
    const headers: Record<string, string> = { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };
    if (type === "image/svg+xml") headers["Content-Security-Policy"] = "script-src 'none'";
    return new Response(data, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
