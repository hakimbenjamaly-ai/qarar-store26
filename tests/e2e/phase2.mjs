// اختبار المرحلة الثانية: المورد ← أمر شراء ← شحنة ← الوصول ← التكلفة الفعلية
// node tests/e2e/phase2.mjs  (نفس متغيرات smoke.mjs، ويتطلب DATABASE_URL للتحقق من المخزون)
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const stamp = Date.now().toString().slice(-6);
const db = new PrismaClient();
const browser = await chromium.launch();
const a = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const shot = async (p, name) => SHOTS && p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const step = (s) => console.log("•", s);
const ok = () => a.waitForURL(/ok=/);
// يزيل رسالة النجاح السابقة من العنوان حتى ننتظر نتيجة الإجراء الجديد فعلاً
const strip = () => a.evaluate(() => history.replaceState(history.state, "", location.pathname));
const go = (p) => a.goto(`${BASE}${p}`);

step("دخول");
await go("/admin/login");
await a.fill("#email", process.env.ADMIN_EMAIL);
await a.fill("#password", process.env.ADMIN_PASSWORD);
await a.click("button:has-text('دخول')");
await a.waitForURL(`${BASE}/admin`);

step("سعر صرف ومدينة");
await go("/admin/settings?tab=rates");
await a.fill("input[name=currency]", "USD");
await a.fill("input[name=rate]", "7");
await strip();
await a.click("form:has(input[name=rate]) button");
await ok();
await go("/admin/settings?tab=cities");
const row = a.locator("form", { has: a.locator("input[name=name][value='بنغازي']") });
await row.locator("input[name=deliveryFee]").fill("20");
await row.locator("input[name=active]").check();
await strip();
await row.locator("button").click();
await ok();

step("مورد وشركة شحن");
await go("/admin/suppliers");
const sf = a.locator("form:has(input[name=platform])").first();
await sf.locator("input[name=name]").fill(`مورد ${stamp}`);
await sf.locator("input[name=platform]").fill("AliExpress");
await strip();
await sf.locator("button").last().click();
await ok();
await go("/admin/shipments/carriers");
const cf = a.locator("form:has(input[name=trackingUrl])").first();
await cf.locator("input[name=name]").fill(`ناقل ${stamp}`);
await cf.locator("input[name=trackingUrl]").fill("https://track.example/{tracking}");
await strip();
await cf.locator("button").last().click();
await ok();

step("منتج مستورد مرتبط بالمورد");
const SKU = `P2-${stamp}`;
await go("/admin/products/new");
await a.fill("input[name=name]", `ساعة ${stamp}`);
await a.fill("input[name=sku]", SKU);
await a.selectOption("select[name=categoryId]", { index: 1 });
await a.check("input[name=published]");
await a.selectOption("select[name=supplierId]", { label: `مورد ${stamp} (AliExpress)` });
await a.locator("label:has-text('سعر الشراء من المورد') input").first().fill("20");
await a.locator("label:has-text('هامش الربح') input").first().fill("50");
await a.click("button:has-text('اعتماد السعر المقترح')");
await a.click("button:has-text('حفظ المنتج')");
await a.waitForURL(/\/admin\/products\/c.*ok=/);

step("ربط المنتج برابط لدى المورد");
await go("/admin/suppliers");
await a.click(`text=مورد ${stamp}`);
await a.waitForURL(/\/admin\/suppliers\/c/);
await a.fill("form:has(input[name=sku]) input[name=sku]", SKU);
await a.fill("form:has(input[name=sku]) input[name=price]", "19.5");
await a.fill("form:has(input[name=sku]) input[name=url]", "https://supplier.example/item/1");
await strip();
await a.click("form:has(input[name=sku]) button");
await ok();
const supplierUrl = a.url().split("?")[0];

step("العميل يطلب قطعتين");
const shop = await browser.newPage();
await shop.goto(`${BASE}/search?q=${stamp}`);
await shop.click(`text=ساعة ${stamp}`);
await shop.click("button[aria-label='زيادة']");
await shop.click("button:has-text('أضف إلى السلة')");
await shop.goto(`${BASE}/checkout`);
await shop.fill("#fullName", "عميل المرحلة الثانية");
const PHONE = `092${stamp}1`.slice(0, 10);
await shop.fill("#phone", PHONE);
await shop.selectOption("#city", { label: "بنغازي" });
await shop.fill("#address", "شارع جمال عبد الناصر");
await shop.click("button:has-text('تأكيد الطلب')");
await shop.waitForURL(/\/track\?n=ORD-/);
const orderNo = new URL(shop.url()).searchParams.get("n");

step("الإدارة تؤكد الطلب وتنقله إلى قيد الشراء");
await go(`/admin/orders?q=${orderNo}`);
await a.click(`text=${orderNo}`);
await a.waitForURL(/\/admin\/orders\/c/);
const orderUrl = a.url();
await a.locator("select[name=to]").first().selectOption("PURCHASING");
await strip();
await a.locator("button:has-text('تحديث')").first().click();
await ok();

step("قائمة بانتظار الشراء ← أمر شراء");
await go("/admin/purchasing");
const grp = a.locator("form", { hasText: orderNo });
await grp.locator("button:has-text('إنشاء أمر شراء')").click();
await a.waitForURL(/\/admin\/purchase-orders\/c/);
const poUrl = a.url().split("?")[0];
assert.equal(await a.locator("input[name^=price_]").first().inputValue(), "19.5", "السعر الافتراضي من رابط المورد");
await a.fill("input[name=supplierOrderNo]", `AE-${stamp}`);
await a.fill("input[name=invoiceNo]", `INV-${stamp}`);
await strip();
await a.click("button:has-text('حفظ')");
await ok();
await a.setInputFiles("input[name=file]", path.resolve("tests/e2e/fixture.png"));
await strip();
await a.click("form:has(input[name=file]) button:has-text('رفع')");
await ok();
await strip();
await a.click("button:has-text('تأكيد: تم الشراء من المورد')");
await ok();
await a.waitForSelector("text=تم شراء المنتج");
await shot(a, "p2-01-po");

step("أمر شراء للمخزون (5 قطع)");
await a.goto(supplierUrl);
await a.click("text=+ أمر شراء للمخزون");
await a.click("button:has-text('إنشاء')");
await a.waitForURL(/\/admin\/purchase-orders\/c/);
const stockPoUrl = a.url();
await a.fill("form:has(input[name=qty]) input[name=sku]", SKU);
await a.fill("form:has(input[name=qty]) input[name=qty]", "5");
await a.fill("form:has(input[name=qty]) input[name=price]", "18");
await strip();
await a.click("form:has(input[name=qty]) button");
await ok();
await strip();
await a.click("button:has-text('تأكيد: تم الشراء من المورد')");
await ok();

step("شحنة دولية: بيانات وبنود وتوزيع التكلفة");
await go("/admin/shipments");
await a.click("button:has-text('شحنة جديدة')");
await a.waitForURL(/\/admin\/shipments\/c/);

await a.selectOption("select[name=carrierId]", { label: `ناقل ${stamp}` });
await a.fill("input[name=trackingNumber]", `TRK${stamp}`);
await a.fill("input[name=originCountry]", "الصين");
await a.fill("input[name=weightKg]", "3.5");
await a.fill("input[name=cost]", "70");
await a.fill("input[name=customsFeesLyd]", "21");
await strip();
await a.click("button:has-text('حفظ وتوزيع التكاليف')");
await a.waitForURL(/(ok|err)=/);
await a.waitForSelector("input[name=poItemId]");
for (const cb of await a.locator("input[name=poItemId]").all()) {
  const tr = cb.locator("xpath=ancestor::tr");
  if ((await tr.innerText()).includes(`ساعة ${stamp}`)) await cb.check();
}
await strip();
await a.click("button:has-text('إضافة المحدد إلى الشحنة')");
await ok();
// 70 USD × 7 = 490 + 21 جمارك = 511 موزعة حسب القيمة: 2×19.5=39 و 5×18=90
await a.waitForSelector("text=511");
await a.selectOption("select[name=to]", "IN_TRANSIT");
await strip();
await a.click("button:has-text('تحديث')");
await ok();
assert.ok(await a.locator("a:has-text('تتبع لدى')").getAttribute("href").then((h) => h.endsWith(`TRK${stamp}`)));

step("العميل يرى «قيد الشحن الدولي»");
await shop.goto(`${BASE}/track?n=${orderNo}&p=${PHONE}`);
await shop.waitForSelector("text=قيد الشحن الدولي");

step("الوصول إلى ليبيا ثم الاستلام");
await a.selectOption("select[name=to]", "ARRIVED_LIBYA");
await strip();
await a.click("button:has-text('تحديث')");
await ok();
const before = (await db.productVariant.findUnique({ where: { sku: SKU } })).stockQty;
await a.selectOption("select[name=to]", "RECEIVED");
await strip();
await a.click("button:has-text('تحديث')");
await ok();
await shot(a, "p2-02-shipment");
const after = (await db.productVariant.findUnique({ where: { sku: SKU } })).stockQty;
assert.equal(after - before, 5, "أُضيفت كمية المخزون");

step("التكلفة الفعلية على بند العميل");
const item = await db.orderItem.findFirst({ where: { order: { number: orderNo } } });
assert.equal(item.status, "ARRIVED_LIBYA");
// 19.5×7=136.5 + (511×39/129)/2 ≈ 136.5 + 77.245 (فرق قرش للتقريب)
assert.ok(Math.abs(Number(item.actualUnitCostLyd) - 213.745) <= 0.01, `التكلفة الفعلية ${item.actualUnitCostLyd}`);
await a.goto(orderUrl.split("?")[0]);
await a.waitForSelector("span:has-text('وصل إلى ليبيا')");
await shot(a, "p2-03-order");

step("إشعار الوصول ولوحة المؤشرات");
await go("/admin/notifications");
await a.waitForSelector(`text=إلى ليبيا`);
await go("/admin");
await a.waitForSelector("text=تكاليف الشحن والجمارك");
await shot(a, "p2-04-dashboard");

step("لا يمكن إلغاء أمر شراء مشحون");
await a.goto(stockPoUrl.split("?")[0]);
const cancel = a.locator("button:has-text('إلغاء الأمر')");
assert.equal(await cancel.count(), 0);

await browser.close();
await db.$disconnect();
console.log("✓ نجح اختبار المرحلة الثانية");
