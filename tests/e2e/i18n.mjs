// اختبار اللغتين: التبديل، الاتجاه، المحتوى الإنجليزي، رسائل الخطأ، وبقاء لوحة الإدارة عربية
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const stamp = Date.now().toString().slice(-6);
const db = new PrismaClient();
const browser = await chromium.launch();
const shot = async (p, name) => SHOTS && p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const step = (s) => console.log("•", s);

step("إعداد: منتج بخيارين بالاسمين ومدينة مفعّلة");
const cat = await db.category.findFirst({ where: { slug: "electronics" } });
await db.product.create({
  data: {
    sku: `I18N-${stamp}`, name: `سماعة ${stamp}`, nameEn: `Headphones ${stamp}`, slug: `headphones-${stamp}`,
    description: "وصف عربي", descriptionEn: "English description", sourcingType: "LOCAL_STOCK", published: true, categoryId: cat.id,
    variants: { create: [{ sku: `I18N-${stamp}-B`, name: "أسود", nameEn: "Black", price: 80, compareAtPrice: 100, stockQty: 5 }, { sku: `I18N-${stamp}-W`, name: "أبيض", nameEn: "White", price: 85, stockQty: 5 }] },
  },
});
await db.city.updateMany({ where: { name: "طرابلس" }, data: { active: true, deliveryFee: 20 } });

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();

step("العربية افتراضياً");
await p.goto(BASE + "/");
assert.equal(await p.getAttribute("html", "dir"), "rtl");
assert.equal(await p.getAttribute("html", "lang"), "ar");

step("التبديل إلى الإنجليزية من الصفحة الحالية");
await p.goto(`${BASE}/product/headphones-${stamp}`);
await p.click("a:has-text('English')");
await p.waitForURL(`${BASE}/product/headphones-${stamp}`);
assert.equal(await p.getAttribute("html", "dir"), "ltr");
assert.equal(await p.getAttribute("html", "lang"), "en");
await p.waitForSelector(`h1:has-text('Headphones ${stamp}')`);
await p.waitForSelector("text=English description");
await p.waitForSelector("text=Electronics & phones");
await p.waitForSelector("button:has-text('White')");
await p.waitForSelector("text=80 LYD");
await shot(p, "i18n-01-product-en");

step("السلة وإتمام الطلب بالإنجليزية");
await p.click("button:has-text('White')");
await p.click("button:has-text('Add to cart')");
await p.click("text=View cart");
await p.waitForSelector("text=Shopping cart");
await p.waitForSelector(`text=Headphones ${stamp}`);
await p.click("text=Checkout");
await p.waitForSelector("text=Delivery details");
await p.fill("#fullName", "John Test");
await p.fill("#phone", "12345");
await p.selectOption("#city", { label: "Tripoli" });
await p.fill("#address", "Andalus street 5");
await p.click("button:has-text('Place order')");
await p.waitForSelector("text=Invalid phone number. Use the format 09XXXXXXXX");
const phone = `092${stamp}9`.slice(0, 10);
await p.fill("#phone", phone);
await shot(p, "i18n-02-checkout-en");
await p.click("button:has-text('Place order')");
await p.waitForURL(/\/track\?n=ORD-/);
await p.waitForSelector("text=Your order has been received");
await p.waitForSelector("text=New order");
await p.waitForSelector("text=105 LYD");
await shot(p, "i18n-03-track-en");
const number = new URL(p.url()).searchParams.get("n");
const order = await db.order.findUnique({ where: { number }, include: { items: true } });
assert.equal(order.locale, "en");
assert.equal(order.items[0].productName, `سماعة ${stamp}`, "الطلب يحفظ الاسم العربي داخلياً للإدارة");

step("البحث بالاسم الإنجليزي");
await p.goto(`${BASE}/search?q=Headphones+${stamp}`);
await p.waitForSelector("text=1 product");

step("العودة للعربية");
await p.click("a:has-text('العربية')");
await p.waitForSelector(`h1:has-text('سماعة ${stamp}'), h1:has-text('نتائج البحث')`);
assert.equal(await p.getAttribute("html", "dir"), "rtl");

step("لا إعادة توجيه لمواقع خارجية");
const r = await p.request.get(`${BASE}/lang?to=en&back=//evil.example`, { maxRedirects: 0 });
assert.equal(new URL(r.headers()["location"], BASE).host, new URL(BASE).host);

step("لوحة الإدارة تبقى عربية حتى مع اختيار الإنجليزية");
await p.goto(`${BASE}/lang?to=en&back=/admin/login`);
assert.equal(await p.getAttribute("html", "dir"), "rtl");
await p.fill("#email", process.env.ADMIN_EMAIL);
await p.fill("#password", process.env.ADMIN_PASSWORD);
await p.click("button:has-text('دخول')");
await p.waitForURL(`${BASE}/admin`);
assert.equal(await p.getAttribute("html", "lang"), "ar");

step("حقل الاسم الإنجليزي في نموذج المنتج يُحفظ");
const prod = await db.product.findUnique({ where: { slug: `headphones-${stamp}` } });
await p.goto(`${BASE}/admin/products/${prod.id}`);
await p.fill("input[name=nameEn]", `Wireless headphones ${stamp}`);
await p.click("button:has-text('حفظ المنتج')");
await p.waitForURL(/ok=/);
assert.equal((await db.product.findUnique({ where: { id: prod.id } })).nameEn, `Wireless headphones ${stamp}`);

await browser.close();
await db.$disconnect();
console.log("✓ نجح اختبار اللغتين");
