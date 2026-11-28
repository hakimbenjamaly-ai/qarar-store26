import { NextResponse } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

/** تبديل لغة المتجر: /lang?to=en&back=/product/x */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const back = url.searchParams.get("back") ?? "/";
  // نقبل مساراً داخلياً فقط لمنع إعادة التوجيه لمواقع خارجية
  const safe = back.startsWith("/") && !back.startsWith("//") && !back.startsWith("/\\") ? back : "/";
  const res = NextResponse.redirect(new URL(safe, url.origin), 303);
  if (isLocale(to)) {
    res.cookies.set(LOCALE_COOKIE, to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true" });
  }
  return res;
}
