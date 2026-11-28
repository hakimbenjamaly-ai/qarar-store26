// اختبار المسار الكامل: node tests/e2e/smoke.mjs
// يتطلب: خادماً يعمل على BASE_URL، وحساب مدير ADMIN_EMAIL / ADMIN_PASSWORD، وقاعدة بيانات اختبار (يُنشئ بيانات).
import { chromium } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const SHOTS = process.env.SHOTS_DIR;
const stamp = Date.now().toString().slice(-6);
const SKU = `TST-${stamp}`;
const PHONE = `091${stamp}1`.slice(0, 10);

const browser = await chromium.launch();
const admin = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const shot = async (p, name) => SHOTS && p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const step = (s) => console.log("•", s);

step("دخول الإدارة");
await admin.goto(`${BASE}/admin/login`);
await admin.fill("#email", EMAIL);
await admin.fill("#password", PASSWORD);
await admin.click("button:has-text('دخول')");
await admin.waitForURL(`${BASE}/admin`);
await shot(admin, "01-dashboard-empty");

step("سعر صرف USD");
await admin.goto(`${BASE}/admin/settings?tab=rates`);
await admin.fill("input[name=currency]", "USD");
await admin.fill("input[name=rate]", "7.5");
await admin.click("form:has(input[name=rate]) button");
await admin.waitForURL(/ok=/);

step("تفعيل مدينة طرابلس برسوم 15");
await admin.goto(`${BASE}/admin/settings?tab=cities`);
const row = admin.locator("form", { has: admin.locator("input[name=name][value='طرابلس']") });
await row.locator("input[name=deliveryFee]").fill("15");
await row.locator("input[name=active]").check();
await row.locator("input[name=coveredByNawras]").check();
await row.locator("button").click();
await admin.waitForURL(/ok=/);

step("إنشاء منتج مستورد بخيارين وصورة");
await admin.goto(`${BASE}/admin/products/new`);
await admin.fill("input[name=name]", `قميص اختبار ${stamp}`);
await admin.fill("input[name=sku]", SKU);
await admin.selectOption("select[name=categoryId]", { label: "الملابس ← ملابس رجالية" });
await admin.fill("input[name=countryOfOrigin]", "تركيا");
await admin.fill("input[name=leadTimeDays]", "20");
await admin.fill("textarea[name=description]", "وصف تجريبي للاختبار الآلي");
await admin.fill("textarea[name=specs]", "الخامة: قطن\nالمقاس: L");
await admin.check("input[name=published]");
await admin.setInputFiles("input[name=images]", path.resolve("tests/e2e/fixture.png"));
// الخيار الأول + الحاسبة
await admin.getByLabel("اسم الخيار", { exact: true }).first().fill("أبيض / L");
await admin.locator("label:has-text('سعر الشراء من المورد') input").first().fill("10");
await admin.locator("label:has-text('الشحن الدولي للوحدة') input").first().fill("2");
await admin.locator("label:has-text('هامش الربح') input").first().fill("20");
await admin.click("button:has-text('اعتماد السعر المقترح')");
assert.equal(await admin.getByLabel("سعر البيع").first().inputValue(), "108");
await admin.click("button:has-text('إضافة خيار')");
await admin.getByLabel("اسم الخيار", { exact: true }).nth(1).fill("أسود / XL");
await admin.getByLabel("سعر البيع").nth(1).fill("120");
await admin.getByLabel("السعر قبل الخصم").nth(1).fill("150");
await shot(admin, "02-product-form");
await admin.click("button:has-text('حفظ المنتج')");
await admin.waitForURL(/\/admin\/products\/c.*ok=/);
const productUrl = admin.url().split("?")[0];

step("المتجر: الصفحة الرئيسية والبحث");
const shop = await browser.newPage({ viewport: { width: 390, height: 844 } });
await shop.goto(BASE);
await shop.waitForSelector(`text=قميص اختبار ${stamp}`);
await shot(shop, "03-home-mobile");
await shop.goto(`${BASE}/search?q=${encodeURIComponent(stamp)}`);
await shop.click(`text=قميص اختبار ${stamp}`);
await shop.waitForSelector("text=يُطلب من المورد بعد تأكيد طلبك");
const html = await shop.content();
assert.ok(!html.includes("purchasePrice") && !html.includes("marginValue"), "تسربت بيانات التكلفة إلى صفحة المنتج");
await shop.click("button:has-text('أسود / XL')");
await shop.click("button[aria-label='زيادة']");
await shop.click("button:has-text('أضف إلى السلة')");
await shot(shop, "04-product-mobile");
await shop.click("text=عرض السلة");
await shop.waitForSelector("text=240");
await shop.click("text=إتمام الطلب");

step("إتمام الطلب");
await shop.fill("#fullName", "عميل اختبار");
await shop.fill("#phone", PHONE);
await shop.selectOption("#city", { label: "طرابلس" });
await shop.fill("#address", "شارع الاختبار، مبنى 1");
await shop.waitForSelector("text=255");
await shot(shop, "05-checkout-mobile");
await shop.click("button:has-text('تأكيد الطلب')");
await shop.waitForURL(/\/track\?n=ORD-/);
await shop.waitForSelector("text=تم استلام طلبك بنجاح");
const orderNo = new URL(shop.url()).searchParams.get("n");
await shot(shop, "06-track-new");
console.log("  رقم الطلب:", orderNo);

step("محاولة تتبع برقم هاتف خاطئ لا تكشف الطلب");
await shop.goto(`${BASE}/track?n=${orderNo}&p=0919999999`);
await shop.waitForSelector("text=لم نجد طلباً");

step("الإدارة: الطلب يظهر وتغيير الحالة والدفعة");
await admin.goto(`${BASE}/admin/orders?q=${orderNo}`);
await admin.click(`text=${orderNo}`);
await admin.waitForSelector("text=طلب جديد");
await admin.locator("select[name=to]").first().selectOption("CONFIRMING");
await admin.locator("button:has-text('تحديث')").first().click();
await admin.waitForURL(/ok=/);
await admin.locator("select[name=to]").first().selectOption("PURCHASING");
await admin.locator("button:has-text('تحديث')").first().click();
await admin.waitForURL(/ok=/);
await admin.waitForSelector("text=قيد الشراء من المورد");
await admin.selectOption("select[name=kind]", "DEPOSIT");
await admin.fill("input[name=amount]", "50");
await admin.click("button:has-text('تسجيل الدفعة')");
await admin.waitForURL(/ok=/);
await admin.waitForSelector("text=205");
await shot(admin, "07-order-admin");

step("العميل يرى الحالة الجديدة");
await shop.goto(`${BASE}/track?n=${orderNo}&p=${PHONE}`);
await shop.waitForSelector("text=قيد الشراء من المورد");

step("لوحة المؤشرات تحسب الطلب");
await admin.goto(`${BASE}/admin`);
await admin.waitForSelector("text=الأرباح المتوقعة");
await shot(admin, "08-dashboard");

step("حذف منتج مرتبط بطلب مرفوض");
await admin.goto(productUrl);
await admin.click("button:has-text('حذف المنتج')");
await admin.click("button:has-text('اضغط مجدداً')");
await admin.waitForSelector("text=مرتبط بطلبات سابقة");

step("سجل العمليات");
await admin.goto(`${BASE}/admin/audit`);
await admin.waitForSelector("text=status_change");

await browser.close();
console.log("✓ نجح اختبار المسار الكامل");
