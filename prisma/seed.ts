// تهيئة البيانات الأساسية فقط: الأدوار، طرق الدفع، هيكل الأقسام، أسماء المدن (بالعربية والإنجليزية).
// لا يضيف منتجات أو طلبات أو أسعاراً. آمن للتشغيل أكثر من مرة، ويكمل الأسماء الإنجليزية الفارغة فقط.
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES } from "../src/lib/permissions";

const db = new PrismaClient();

const CATEGORIES: [string, string, string, [string, string][]][] = [
  ["الملابس", "Clothing", "clothing", [["ملابس رجالية", "Men's clothing"], ["ملابس نسائية", "Women's clothing"], ["ملابس أطفال", "Kids' clothing"]]],
  ["الأحذية والحقائب", "Shoes & bags", "shoes-bags", []],
  ["الإلكترونيات والهواتف", "Electronics & phones", "electronics", [["هواتف", "Phones"], ["ملحقات الهواتف", "Phone accessories"]]],
  ["الأجهزة المنزلية والمطبخ", "Home appliances & kitchen", "home-appliances", []],
  ["مستلزمات الأطفال والأمهات", "Baby & mother", "baby-mother", []],
  ["العناية الشخصية والتجميل", "Personal care & beauty", "beauty", []],
  ["الأثاث والديكور", "Furniture & decor", "furniture-decor", []],
  ["أدوات السيارات وملحقاتها", "Car accessories", "car-accessories", []],
  ["الأدوات الرياضية", "Sports", "sports", []],
  ["الألعاب والهدايا", "Toys & gifts", "toys-gifts", []],
  ["الأدوات المكتبية والمدرسية", "Office & school", "office-school", []],
  ["مستلزمات المنزل والحدائق", "Home & garden", "home-garden", []],
];

// أسماء المدن فقط، غير مفعّلة. المدير يفعّل المدن ويحدد رسوم التوصيل بعد الاتفاق مع النورس.
const CITIES: [string, string][] = [
  ["طرابلس", "Tripoli"], ["بنغازي", "Benghazi"], ["مصراتة", "Misrata"], ["الزاوية", "Zawiya"], ["زليتن", "Zliten"], ["الخمس", "Khoms"],
  ["صبراتة", "Sabratha"], ["زوارة", "Zuwara"], ["غريان", "Gharyan"], ["ترهونة", "Tarhuna"], ["بني وليد", "Bani Walid"], ["سرت", "Sirte"],
  ["أجدابيا", "Ajdabiya"], ["البيضاء", "Bayda"], ["المرج", "Marj"], ["درنة", "Derna"], ["طبرق", "Tobruk"], ["سبها", "Sabha"],
  ["أوباري", "Ubari"], ["غات", "Ghat"], ["مرزق", "Murzuq"], ["الكفرة", "Kufra"], ["يفرن", "Yafran"], ["نالوت", "Nalut"],
];

async function main() {
  for (const r of DEFAULT_ROLES) {
    await db.role.upsert({ where: { key: r.key }, create: { ...r, system: true }, update: {} });
  }

  const methods = [
    { code: "COD", name: "الدفع عند الاستلام", nameEn: "Cash on delivery", enabled: true, sortOrder: 1, instructions: "تدفع قيمة الطلب نقداً لمندوب التوصيل عند الاستلام.", instructionsEn: "Pay the order amount in cash to the courier on delivery." },
    { code: "BANK_TRANSFER", name: "تحويل مصرفي", nameEn: "Bank transfer", enabled: false, sortOrder: 2, instructions: "", instructionsEn: "" },
    { code: "ONLINE", name: "دفع إلكتروني", nameEn: "Online payment", enabled: false, sortOrder: 3, instructions: "", instructionsEn: "" },
  ];
  for (const m of methods) {
    await db.paymentMethod.upsert({ where: { code: m.code }, create: m, update: {} });
    await db.paymentMethod.updateMany({ where: { code: m.code, nameEn: "" }, data: { nameEn: m.nameEn } });
    if (m.instructionsEn) await db.paymentMethod.updateMany({ where: { code: m.code, instructionsEn: "" }, data: { instructionsEn: m.instructionsEn } });
  }

  let order = 0;
  for (const [name, nameEn, slug, children] of CATEGORIES) {
    const parent = await db.category.upsert({ where: { slug }, create: { name, nameEn, slug, sortOrder: order++ }, update: {} });
    await db.category.updateMany({ where: { id: parent.id, nameEn: "" }, data: { nameEn } });
    let co = 0;
    for (const [child, childEn] of children) {
      const cslug = `${slug}-${co + 1}`;
      const c = await db.category.upsert({ where: { slug: cslug }, create: { name: child, nameEn: childEn, slug: cslug, parentId: parent.id, sortOrder: co++ }, update: {} });
      await db.category.updateMany({ where: { id: c.id, nameEn: "" }, data: { nameEn: childEn } });
    }
  }

  let ci = 0;
  for (const [name, nameEn] of CITIES) {
    await db.city.upsert({ where: { name }, create: { name, nameEn, active: false, sortOrder: ci++ }, update: {} });
    await db.city.updateMany({ where: { name, nameEn: "" }, data: { nameEn } });
  }

  console.log("تمت تهيئة البيانات الأساسية.");
}

main().finally(() => db.$disconnect());
