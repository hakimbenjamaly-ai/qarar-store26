import "server-only";
import { redirect } from "next/navigation";

export function flashRedirect(path: string, msg: { ok?: string; err?: string }): never {
  const sep = path.includes("?") ? "&" : "?";
  const q = msg.err ? `err=${encodeURIComponent(msg.err)}` : `ok=${encodeURIComponent(msg.ok ?? "تم الحفظ")}`;
  redirect(`${path}${sep}${q}`);
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const num = (fd: FormData, k: string, def = 0) => {
  const v = str(fd, k).replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
  const n = Number(v);
  return v === "" || Number.isNaN(n) ? def : n;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1" || fd.get(k) === "true";
