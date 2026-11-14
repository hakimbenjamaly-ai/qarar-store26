// تهيئة البيانات الأساسية فقط: الأدوار، طرق الدفع، هيكل الأقسام، أسماء المدن.
// لا يضيف منتجات أو طلبات أو أسعاراً. آمن للتشغيل أكثر من مرة.
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES } from "../src/lib/permissions";

const db = new PrismaClient();

const CATEGORIES = [
  ["الملابس", "clothing", ["ملابس رجالية", "ملابس نسائية", "ملابس أطفال"]],
  ["الأحذية والحقائب", "shoes-bags", []],
  ["الإلكترونيات والهواتف", "electronics", ["هواتف", "ملحقات الهواتف"]],
  ["الأجهزة المنزلية والمطبخ", "home-appliances", []],
  ["مستلزمات الأطفال والأمهات", "baby-mother", []],
  ["العناية الشخصية والتجميل", "beauty", []],
  ["الأثاث والديكور", "furniture-decor", []],
  ["أدوات السيارات وملحقاتها", "car-accessories", []],
  ["الأدوات الرياضية", "sports", []],
  ["الألعاب والهدايا", "toys-gifts", []],
  ["الأدوات المكتبية والمدرسية", "office-school", []],
  ["مستلزمات المنزل والحدائق", "home-garden", []],
] as const;

// أسماء المدن فقط، غير مفعّلة. المدير يفعّل المدن ويحدد رسوم التوصيل بعد الاتفاق مع النورس.
const CITIES = ["طرابلس", "بنغازي", "مصراتة", "الزاوية", "زليتن", "الخمس", "صبراتة", "زوارة", "غريان", "ترهونة", "بني وليد", "سرت", "أجدابيا", "البيضاء", "المرج", "درنة", "طبرق", "سبها", "أوباري", "غات", "مرزق", "الكفرة", "يفرن", "نالوت"];

async function main() {
  for (const r of DEFAULT_ROLES) {
    await db.role.upsert({ where: { key: r.key }, create: { ...r, system: true }, update: {} });
  }

  const methods = [
    { code: "COD", name: "الدفع عند الاستلام", enabled: true, sortOrder: 1, instructions: "تدفع قيمة الطلب نقداً لمندوب التوصيل عند الاستلام." },
    { code: "BANK_TRANSFER", name: "تحويل مصرفي", enabled: false, sortOrder: 2, instructions: "" },
    { code: "ONLINE", name: "دفع إلكتروني", enabled: false, sortOrder: 3, instructions: "" },
  ];
  for (const m of methods) await db.paymentMethod.upsert({ where: { code: m.code }, create: m, update: {} });

  let order = 0;
  for (const [name, slug, children] of CATEGORIES) {
    const parent = await db.category.upsert({ where: { slug }, create: { name, slug, sortOrder: order++ }, update: {} });
    let co = 0;
    for (const child of children) {
      const cslug = `${slug}-${co + 1}`;
      await db.category.upsert({ where: { slug: cslug }, create: { name: child, slug: cslug, parentId: parent.id, sortOrder: co++ }, update: {} });
    }
  }

  let ci = 0;
  for (const name of CITIES) await db.city.upsert({ where: { name }, create: { name, active: false, sortOrder: ci++ }, update: {} });

  console.log("تمت تهيئة البيانات الأساسية.");
}

main().finally(() => db.$disconnect());
