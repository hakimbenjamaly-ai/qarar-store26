import { NextResponse, type NextRequest } from "next/server";

// فحص سريع لوجود جلسة؛ التحقق الكامل والصلاحيات تتم في الخادم داخل كل صفحة.
// كما يمرّر المسار للتخطيط الجذري حتى تبقى لوحة الإدارة عربية مهما كانت لغة المتجر.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !req.cookies.get("qarar_session")) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const headers = new Headers(req.headers);
  headers.set("x-qarar-path", pathname);
  headers.set("x-qarar-url", pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/|files/|favicon).*)"] };
