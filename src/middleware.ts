import { NextResponse, type NextRequest } from "next/server";

// فحص سريع لوجود جلسة؛ التحقق الكامل والصلاحيات تتم في الخادم داخل كل صفحة.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !req.cookies.get("qarar_session")) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
