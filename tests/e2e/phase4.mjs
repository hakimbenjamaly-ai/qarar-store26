// اختبار المرحلة الرابعة: التقارير وتصدير Excel، المصروفات وأثرها على صافي الربح،
// تنبيه انخفاض المخزون، رسائل العميل بلغته مع تسجيل فتح واتساب، وإعدادات البريد.
// node tests/e2e/phase4.mjs  (نفس متغيرات smoke.mjs ويتطلب DATABASE_URL)
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const stamp = Date.now().toString().slice(-6);
const db = new PrismaClient();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const a = await ctx.newPage();
const shot = async (p, name) => SHOTS && p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const step = (s) => console.log("•", s);
const go = (p, page = a) => page.goto(`${BASE}${p}`);
const strip = (p = a) =>
  p.evaluate(() => {
    const q = new URLSearchParams(location.search);
    q.delete("ok");
    q.delete("err");
    history.replaceState(history.state, "", location.pathname + (q.size ? "?" + q : ""));
  });
const submit = async (btn, re = /ok=/, p = a) => {
  await strip(p);
  await btn.click();
  await p.waitForURL(re);
};
const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);

/** ينزّل ملف Excel للتقرير ويعيد قيم ورقة الملخص {label: value} */
async function xlsxSummary(type) {
  await go(`/admin/reports?type=${type}&from=${today}&to=${today}`);
  const [dl] = await Promise.all([a.waitForEvent("download"), a.click("a:has-text('تنزيل Excel')")]);
  const file = await dl.path();
  const buf = fs.readFileSync(file);
  assert.equal(buf.subarray(0, 2).toString(), "PK", "ملف xlsx حقيقي");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet("الملخص");
  assert.ok(ws, "ورقة الملخص موجودة");
  const out = {};
  ws.eachRow((r) => { if (r.getCell(2).value !== null && r.getCell(2).value !== undefined) out[String(r.getCell(1).value)] = Number(r.getCell(2).value); });
  return { out, sheets: wb.worksheets.map((w) => w.name), name: dl.suggestedFilename() };
}

step("إعداد: منتج محلي بتكلفة 60 د.ل ومخزون 4 قطع، حد التنبيه 3");
const cat = await db.category.findFirst({ where: { parentId: { not: null } } });
const SKU = `R4-${stamp}`;
const prod = await db.product.create({
  data: {
    sku: SKU, name: `ساعة ${stamp}`, nameEn: `Watch ${stamp}`, slug: `watch-${stamp}`, sourcingType: "LOCAL_STOCK", published: true, categoryId: cat.id,
    variants: { create: { sku: SKU, price: 100, stockQty: 4, cost: { create: { purchasePrice: 60, purchaseCurrency: "LYD", shippingCost: 0, shippingCurrency: "LYD" } } } },
  },
});
await db.city.updateMany({ where: { name: "طرابلس" }, data: { active: true, deliveryFee: 20 } });

step("دخول الإدارة وضبط حد المخزون من الإعدادات");
await go("/admin/login");
await a.fill("#email", process.env.ADMIN_EMAIL);
await a.fill("#password", process.env.ADMIN_PASSWORD);
await a.click("button:has-text('دخول')");
await a.waitForURL(`${BASE}/admin`);
await go("/admin/settings?tab=notifications");
await a.getByText("البريد غير مضبوط بعد").or(a.getByText("البريد مضبوط على الخادم")).first().waitFor();
await a.fill("input[name=notifyEmails]", "owner@example.com, bad-email");
await a.fill("input[name=lowStockThreshold]", "3");
await submit(a.locator("form:has(input[name=notifyEmails]) button:has-text('حفظ')"));
assert.equal(await a.inputValue("input[name=notifyEmails]"), "owner@example.com", "يُحفظ البريد الصحيح فقط");
await shot(a, "p4-01-notify-settings");

step("لقطة صافي الربح قبل العملية");
const before = await xlsxSummary("profit");
assert.ok(before.name.endsWith(".xlsx"));
assert.ok(before.sheets.length >= 2, "ملخص + أقسام");

step("عميل يطلب بالإنجليزية من المتجر");
const shop = await ctx.newPage();
await go(`/lang?to=en&back=/product/watch-${stamp}`, shop);
await shop.click("button:has-text('Add to cart')");
await go("/checkout", shop);
await shop.fill("#fullName", "John Smith");
const phone = `092${stamp}1`.slice(0, 10);
await shop.fill("#phone", phone);
await shop.selectOption("#city", { label: (await db.city.findFirst({ where: { name: "طرابلس" } })).nameEn || "طرابلس" });
await shop.fill("#address", "Andalus district");
await shop.click("button:has-text('Place order')");
await shop.waitForURL(/\/track\?n=ORD-/);
const number = new URL(shop.url()).searchParams.get("n");
const order = await db.order.findUnique({ where: { number } });
assert.equal(order.locale, "en");

step("تنبيه انخفاض المخزون (4 → 3)");
const low = await db.notification.findFirst({ where: { event: "stock.low", title: { contains: `ساعة ${stamp}` } } });
assert.ok(low, "أُنشئ إشعار stock.low");

step("رسائل العميل بلغته وفتح واتساب يُسجَّل");
await go(`/admin/orders/${order.id}`);
await a.getByText("لغة العميل: الإنجليزية").waitFor();
const body = await a.inputValue("textarea[aria-label='نص الرسالة']");
assert.match(body, /^Hello John Smith, your order ORD-/);
assert.ok(body.includes(`/track?n=${number}&p=${phone}`), "رابط التتبع في الرسالة");
await a.selectOption("select[aria-label='القالب']", "order.out_for_delivery");
const body2 = await a.inputValue("textarea[aria-label='نص الرسالة']");
assert.match(body2, /out for delivery today\. Please have 120 LYD ready/);
const waHref = await a.getAttribute("a:has-text('فتح واتساب')", "href");
assert.ok(waHref.startsWith(`https://wa.me/218${phone.slice(1)}?text=`), waHref);
// نمنع فتح الموقع الخارجي فعلياً أثناء الاختبار ونكتفي بالتحقق من الرابط والتسجيل
await ctx.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "ok" }));
const [popup] = await Promise.all([ctx.waitForEvent("page"), a.click("a:has-text('فتح واتساب')")]);
await popup.close();
await a.locator("[data-testid=msg-log] li").first().waitFor();
const log = await db.messageLog.findFirst({ where: { orderId: order.id } });
assert.equal(log.channel, "whatsapp");
assert.equal(log.template, "order.out_for_delivery");
assert.equal(log.status, "opened");
await shot(a, "p4-02-customer-messages");

step("تسليم الطلب يدوياً من صفحة الطلب");
await a.locator("select[name=to]").first().selectOption("CONFIRMING");
await submit(a.locator("button:has-text('تحديث')").first());
await a.locator("select[name=to]").first().selectOption("DELIVERED");
await submit(a.locator("button:has-text('تحديث')").first());
assert.equal((await db.order.findUnique({ where: { id: order.id } })).status, "DELIVERED");

step("تسجيل مصروف 35.5 د.ل");
await go("/admin/expenses");
await a.selectOption("select[aria-label='البند']", "إعلانات وتسويق");
await a.fill("input[aria-label='المبلغ']", "35.5");
await a.fill("input[aria-label='ملاحظة']", `حملة ${stamp}`);
await submit(a.locator("button:has-text('إضافة')"));
await a.getByText(`حملة ${stamp}`).waitFor();
await shot(a, "p4-03-expenses");

step("صافي الربح تغيّر بالقيمة الصحيحة (ربح الطلب 100−60+20 = 60، ناقص المصروف 35.5)");
const after = await xlsxSummary("profit");
const d = (k) => Math.round((after.out[k] - before.out[k]) * 100) / 100;
assert.equal(d("طلبات مسلّمة في الفترة"), 1);
assert.equal(d("تكلفة البضاعة"), 60);
assert.equal(d("الربح من الطلبات (بعد التوصيل)"), 60);
assert.equal(d("المصروفات التشغيلية"), 35.5);
assert.equal(d("صافي الربح"), 24.5);
await go(`/admin/reports?type=profit&from=${today}&to=${today}`);
await a.getByText(number).first().waitFor();
await shot(a, "p4-04-profit-report");

step("كل التقارير تُعرض وتُصدَّر بدون أخطاء");
for (const type of ["sales", "purchasing", "delivery", "receivables", "cash", "inventory", "customers"]) {
  await go(`/admin/reports?type=${type}&from=${today}&to=${today}`);
  await a.locator("h2").first().waitFor();
  assert.equal(await a.getByText("Application error").count(), 0, type);
  const res = await a.request.get(`${BASE}/admin/reports/export?type=${type}&from=${today}&to=${today}`);
  assert.equal(res.status(), 200, type);
  assert.match(res.headers()["content-type"], /spreadsheetml/);
}
const sales = await xlsxSummary("sales");
assert.ok(Object.keys(sales.out).length > 0);

step("حذف المصروف يعيد صافي الربح");
await go("/admin/expenses");
const row = a.locator("tr", { hasText: `حملة ${stamp}` });
await row.locator("button:has-text('حذف')").click();
await submit(row.locator("button"));
const again = await xlsxSummary("profit");
assert.equal(Math.round((again.out["صافي الربح"] - before.out["صافي الربح"]) * 100) / 100, 60);

step("مسار cron محمي بمفتاح");
const cron = await a.request.get(`${BASE}/api/cron/notify`);
assert.equal(cron.status(), 401);

await browser.close();
await db.$disconnect();
console.log("✓ اختبار المرحلة الرابعة نجح");
