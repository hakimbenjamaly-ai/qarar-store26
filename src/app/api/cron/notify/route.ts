import { NextResponse } from "next/server";
import { dispatchEmails, smtpConfigured } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** يُستدعى من مهمة cron على الخادم: /api/cron/notify?key=CRON_SECRET */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-cron-key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!smtpConfigured()) return NextResponse.json({ configured: false, sent: 0 });
  return NextResponse.json({ configured: true, ...(await dispatchEmails(50)) });
}
