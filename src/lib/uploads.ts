import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

const MAX_BYTES = 8 * 1024 * 1024;

/** يحفظ ملفاً مرفوعاً ويعيد رابطه العام، أو null إن لم يُرفع ملف */
export async function saveUpload(file: File | null, folder: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("نوع الملف غير مدعوم (المسموح: JPG, PNG, WEBP, SVG, PDF)");
  if (file.size > MAX_BYTES) throw new Error("حجم الملف أكبر من 8 ميغابايت");
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "");
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const dir = path.join(UPLOAD_DIR, safeFolder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/files/${safeFolder}/${name}`;
}

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(ALLOWED).map(([m, e]) => [e, m]));
