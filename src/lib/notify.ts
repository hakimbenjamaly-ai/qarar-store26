import "server-only";
import nodemailer from "nodemailer";
import { db } from "./db";
import { getSettings } from "./settings";

/** أسماء الأحداث القابلة للإرسال بالبريد */
export const EMAIL_EVENTS: Record<string, string> = {
  "order.new": "طلب جديد من الموقع",
  "contact.new": "رسالة جديدة من صفحة التواصل",
  "shipment.arrived": "وصول شحنة دولية إلى ليبيا",
  "delivery.failed": "تعثّر توصيل لدى النورس",
  "delivery.amount_mismatch": "اختلاف المبلغ المحصّل عن المطلوب",
  "stock.low": "انخفاض مخزون منتج محلي",
};

/** البريد يعمل فقط إذا ضُبطت متغيرات SMTP على الخادم */
export function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
}

export function parseEmails(s: string): string[] {
  return s
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
}

function siteUrl() {
  return (process.env.SITE_URL ?? "").replace(/\/$/, "");
}

export async function sendMail(to: string[], subject: string, text: string) {
  await transport().sendMail({ from: process.env.SMTP_FROM, to: to.join(", "), subject, text });
}

let running = false;

/**
 * يرسل إشعارات الإدارة الجديدة بالبريد. آمن للاستدعاء المتكرر:
 * - كل إشعار يُعالج مرة واحدة (emailStatus: sent | failed | skipped).
 * - الإشعارات الأقدم من يوم أو التي لا يشملها الاختيار تُعلَّم skipped.
 * - بدون SMTP مضبوط لا يحدث شيء ويبقى الإشعار داخل اللوحة فقط.
 */
export async function dispatchEmails(limit = 20): Promise<{ sent: number; failed: number; skipped: number }> {
  const res = { sent: 0, failed: 0, skipped: 0 };
  if (!smtpConfigured() || running) return res;
  running = true;
  try {
    const s = await getSettings();
    const to = parseEmails(s.notifyEmails);
    const pending = await db.notification.findMany({ where: { emailStatus: null }, orderBy: { createdAt: "asc" }, take: limit });
    const dayAgo = Date.now() - 24 * 3600e3;
    for (const n of pending) {
      if (to.length === 0 || !s.emailEvents.includes(n.event) || n.createdAt.getTime() < dayAgo) {
        await db.notification.update({ where: { id: n.id }, data: { emailStatus: "skipped" } });
        res.skipped++;
        continue;
      }
      // حجز الإشعار قبل الإرسال لتجنب الإرسال المزدوج من عمليتين متزامنتين
      const claimed = await db.notification.updateMany({ where: { id: n.id, emailStatus: null }, data: { emailStatus: "sending" } });
      if (claimed.count !== 1) continue;
      try {
        const link = n.link ? `${siteUrl()}${n.link}` : "";
        await sendMail(to, `[${s.storeName}] ${n.title}`, [n.title, n.body, link].filter(Boolean).join("\n\n"));
        await db.notification.update({ where: { id: n.id }, data: { emailStatus: "sent", emailedAt: new Date(), emailError: "" } });
        res.sent++;
      } catch (e) {
        await db.notification.update({ where: { id: n.id }, data: { emailStatus: "failed", emailError: String((e as Error).message).slice(0, 500) } });
        res.failed++;
      }
    }
  } finally {
    running = false;
  }
  return res;
}
