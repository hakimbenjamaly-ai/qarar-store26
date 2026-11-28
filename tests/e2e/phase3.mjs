// اختبار المرحلة الثالثة: التجهيز ← دفعة تسليم للنورس ← بوابة موظف النورس ← استيراد ملف ← مرتجع ← تسوية
// node tests/e2e/phase3.mjs  (نفس متغيرات smoke.mjs ويتطلب DATABASE_URL)
// يُنشئ منتج مخزون محلي عبر قاعدة البيانات لتسريع الإعداد فقط؛ كل خطوات التوزيع تتم من الواجهة.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const stamp = Date.now().toString().slice(-6);
const db = new PrismaClient();
const browser = await chromium.launch();
const a = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const shot = async (p, name) => SHOTS && p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const step = (s) => console.log("•", s);
const go = (p, page = a) => page.goto(`${BASE}${p}`);
// يزيل رسالة النتيجة السابقة من العنوان حتى ننتظر نتيجة الإجراء الجديد فعلاً
const strip = (p = a) => p.evaluate(() => history.replaceState(history.state, "", location.pathname));
const submit = async (btn, re = /ok=/, p = a) => {
  await strip(p);
  await btn.click();
  await p.waitForURL(re);
};

step("إعداد: منتج مخزون محلي (10 قطع) ومدينة مفعّلة");
const cat = await db.category.findFirst({ where: { parentId: { not: null } } });
const SKU = `L3-${stamp}`;
const prod = await db.product.create({
  data: { sku: SKU, name: `مصباح ${stamp}`, slug: `lamp-${stamp}`, sourcingType: "LOCAL_STOCK", published: true, categoryId: cat.id, variants: { create: { sku: SKU, price: 100, stockQty: 10 } } },
  include: { variants: true },
});
const variantId = prod.variants[0].id;
await db.city.updateMany({ where: { name: "طرابلس" }, data: { active: true, deliveryFee: 20 } });

step("دخول الإدارة");
await go("/admin/login");
await a.fill("#email", process.env.ADMIN_EMAIL);
await a.fill("#password", process.env.ADMIN_PASSWORD);
await a.click("button:has-text('دخول')");
await a.waitForURL(`${BASE}/admin`);

step("العملاء يطلبون 3 طلبات");
const shop = await browser.newPage();
const orders = [];
for (const k of [1, 2, 3]) {
  await go(`/product/lamp-${stamp}`, shop);
  await shop.click("button:has-text('أضف إلى السلة')");
  await go("/checkout", shop);
  await shop.fill("#fullName", `عميل توزيع ${k}`);
  const phone = `091${stamp}${k}`.slice(0, 10);
  await shop.fill("#phone", phone);
  await shop.selectOption("#city", { label: "طرابلس" });
  await shop.fill("#address", `حي الأندلس ${k}`);
  await shop.click("button:has-text('تأكيد الطلب')");
  await shop.waitForURL(/\/track\?n=ORD-/);
  orders.push({ number: new URL(shop.url()).searchParams.get("n"), phone });
}

step("تأكيد الطلبات");
for (const o of orders) {
  const row = await db.order.findUnique({ where: { number: o.number } });
  o.id = row.id;
  await go(`/admin/orders/${o.id}`);
  await a.locator("select[name=to]").first().selectOption("CONFIRMING");
  await submit(a.locator("button:has-text('تحديث')").first());
}

step("إضافة شركة النورس ونقطة توزيع");
await go("/admin/delivery/partners");
const existing = await db.deliveryPartner.findFirst({ where: { name: `النورس ${stamp}` } });
assert.equal(existing, null);
const pf = a.locator("form:has(input[name=defaultFee])").last();
await pf.locator("input[name=name]").fill(`النورس ${stamp}`);
await pf.locator("input[name=defaultFee]").fill("12");
await submit(pf.locator("button:has-text('إضافة')"));
const partner = await db.deliveryPartner.findFirst({ where: { name: `النورس ${stamp}` } });
const ptForm = a.locator("form", { has: a.locator(`input[name=partnerId][value='${partner.id}']`) });
await ptForm.locator("input[name=name]").fill("فرع طرابلس");
await ptForm.locator("input[name=city]").fill("طرابلس");
await submit(ptForm.locator("button"));

step("حساب موظف النورس");
const NAW_EMAIL = `nawras${stamp}@test.local`;
await go("/admin/users");
const uf = a.locator("form:has(select[name=deliveryPartnerId])").first();
await uf.locator("input[name=name]").fill(`مندوب ${stamp}`);
await uf.locator("input[name=email]").fill(NAW_EMAIL);
await uf.locator("select[name=roleId]").selectOption({ label: "موظف شركة النورس" });
await uf.locator("select[name=deliveryPartnerId]").selectOption(partner.id);
await uf.locator("input[name=password]").fill("NawrasPass123");
await submit(uf.locator("button:has-text('إضافة')"));

step("جاهز للتجهيز ← تجهيز الطرود");
await go("/admin/delivery");
for (const o of orders) await a.check(`input[name=orderId][value='${o.id}']`);
await a.selectOption("select[name=partnerId]", partner.id);
await shot(a, "p3-01-ready");
await strip();
await a.click("button:has-text('تجهيز طرود للمحدد')");
await a.waitForURL(/delivery\/list\?status=READY/);
const dls = await db.delivery.findMany({ where: { orderId: { in: orders.map((o) => o.id) } }, orderBy: { number: "asc" } });
assert.equal(dls.length, 3);
for (const d of dls) {
  assert.equal(Number(d.codAmount), 120, "المبلغ المطلوب = إجمالي الطلب");
  assert.equal(Number(d.fee), 12);
}
const byOrder = (o) => dls.find((d) => d.orderId === o.id);
const [A, B, C] = orders.map(byOrder);

step("الملصقات");
const labelsHref = await a.locator("a:has-text('طباعة الملصقات')").getAttribute("href");
const back = a.url();
await go(labelsHref);
await a.waitForSelector(`text=${A.number}`);
await shot(a, "p3-02-labels");
await a.goto(back);

step("دفعة تسليم للنورس");
await a.locator("form:has(input[name=receivedBy]) select[name=partnerId]").selectOption(partner.id);
await a.fill("input[name=receivedBy]", "سالم المندوب");
await strip();
await a.click("button:has-text('تسليم المحدد للنورس')");
await a.waitForURL(/delivery\/handovers\/c.*ok=/);
await a.waitForSelector("text=كشف تسليم طرود");
await a.waitForSelector("text=360");
await shot(a, "p3-03-manifest");
const handoverId = a.url().split("/handovers/")[1].split("?")[0];
const it = await db.orderItem.findFirst({ where: { orderId: orders[0].id } });
assert.equal(it.status, "HANDED_TO_NAWRAS");

step("ملف Excel للدفعة");
const csvRes = await a.request.get(`${BASE}/admin/delivery/export?handover=${handoverId}`);
assert.equal(csvRes.status(), 200);
const csvText = await csvRes.text();
assert.ok(csvText.startsWith("﻿"), "BOM");
assert.ok(csvText.includes(C.number) && csvText.includes("حي الأندلس 3"));
assert.ok(!csvText.includes("تكلفة") && !csvText.includes("ربح"), "لا تكاليف في ملف النورس");

step("بوابة موظف النورس");
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const n = await ctx.newPage();
await go("/admin/login", n);
await n.fill("#email", NAW_EMAIL);
await n.fill("#password", "NawrasPass123");
await n.click("button:has-text('دخول')");
await n.waitForURL(/\/admin\/partner/);
await n.waitForSelector(`text=${A.number}`);
await shot(n, "p3-04-portal");
const card = (num) => n.locator(".card", { hasText: num });
// A: خرج ثم سُلّم
await card(A.number).locator("select[name=to]").selectOption("OUT_FOR_DELIVERY");
await submit(card(A.number).locator("button:has-text('حفظ')"), /ok=/, n);
await card(A.number).locator("select[name=to]").selectOption("DELIVERED");
await submit(card(A.number).locator("button:has-text('حفظ')"), /ok=/, n);
// B: تعذر بدون سبب مرفوض، ثم مع السبب
await card(B.number).locator("select[name=to]").selectOption("FAILED");
await submit(card(B.number).locator("button:has-text('حفظ')"), /err=/, n);
await card(B.number).locator("select[name=to]").selectOption("FAILED");
await card(B.number).locator("input[name=reason]").fill("العميل لا يرد");
await submit(card(B.number).locator("button:has-text('حفظ')"), /ok=/, n);
// لا يصل لصفحات الإدارة ولا للإشعارات
await go("/admin/orders", n);
await n.waitForURL(/denied=1/);
await go(`/admin/delivery/${A.id}`, n);
await n.waitForURL(/denied=1/);
await go("/admin/notifications", n);
await n.waitForURL(/\/admin\/partner/);
assert.equal(await n.locator("text=بانتظار الشراء").count(), 0);

step("العميل يرى حالة التسليم");
await go(`/track?n=${orders[0].number}&p=${orders[0].phone}`, shop);
await shop.waitForSelector("text=تم التسليم للعميل");

step("استيراد ملف حالات من النورس");
const csvPath = path.join(os.tmpdir(), `nawras-${stamp}.csv`);
fs.writeFileSync(csvPath, `﻿رقم التوصيلة;الحالة;المبلغ المحصل;سبب التعذر;رقم البوليصة\r\n${C.number};تم التسليم للعميل;110;;NW-${stamp}\r\nDLV-0000-99999;تم التسليم للعميل;;;\r\n`);
await go("/admin/delivery/import");
await a.setInputFiles("input[name=file]", csvPath);
await a.click("button:has-text('استيراد وتطبيق')");
await a.waitForSelector("text=1 صف نجح");
await a.waitForSelector("text=رقم توصيلة غير معروف");
await shot(a, "p3-05-import");
const cNow = await db.delivery.findUnique({ where: { id: C.id } });
assert.equal(cNow.status, "DELIVERED");
assert.equal(Number(cNow.collected), 110);
assert.equal(cNow.waybillNo, `NW-${stamp}`);
assert.ok(await db.notification.findFirst({ where: { event: "delivery.amount_mismatch", link: `/admin/delivery/${C.id}` } }), "إشعار فرق المبلغ");

step("المرتجع يعود للمخزون");
const stockBefore = (await db.productVariant.findUnique({ where: { id: variantId } })).stockQty;
await go(`/admin/delivery/${B.id}`);
await a.selectOption("select[name=to]", "RETURNED");
await a.check("input[name=restock]");
await submit(a.locator("button:has-text('تحديث')"));
const stockAfter = (await db.productVariant.findUnique({ where: { id: variantId } })).stockQty;
assert.equal(stockAfter - stockBefore, 1);
assert.equal((await db.order.findUnique({ where: { id: orders[1].id } })).status, "RETURNED");

step("التسوية مع النورس");
await go(`/admin/delivery/settlements/new?partner=${partner.id}`);
await a.waitForSelector("text=الصافي المتوقع");
// المحصّل 120 + 110 = 230، والأجور 3 × 12 = 36، الصافي المتوقع 194. استلمنا 190 (فرق -4)
await a.fill("input[name=netReceived]", "190");
await a.fill("input[name=reference]", `TRF-${stamp}`);
await a.waitForSelector("text=الفرق عن المستلم");
await strip();
await a.click("button:has-text('تسجيل التسوية')");
await a.waitForURL(/settlements\/c.*ok=/);
await a.waitForSelector("text=كشف تسوية");
await shot(a, "p3-06-settlement");
const st = await db.settlement.findFirst({ where: { reference: `TRF-${stamp}` }, include: { payments: true } });
assert.equal(Number(st.collected), 230);
assert.equal(Number(st.feesDeducted), 36);
assert.equal(Number(st.netReceived), 190);
assert.equal(st.payments.length, 2);
const paidA = await db.payment.aggregate({ where: { orderId: orders[0].id }, _sum: { amount: true } });
assert.equal(Number(paidA._sum.amount), 120);

step("الطلب يعرض التوصيل والتسوية، ولا يمكن تسويتها مرتين");
await go(`/admin/orders/${orders[0].id}`);
await a.waitForSelector(`text=${st.number}`);
await shot(a, "p3-07-order");
await go(`/admin/delivery/settlements/new?partner=${partner.id}`);
await a.waitForSelector("text=لا توجد توصيلات بانتظار التسوية");

await browser.close();
await db.$disconnect();
console.log("✓ نجح اختبار المرحلة الثالثة");
