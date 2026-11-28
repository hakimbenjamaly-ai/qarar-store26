"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getSettings, saveSettings } from "@/lib/settings";
import { saveUpload } from "@/lib/uploads";
import { bool, flashRedirect, num, str } from "@/lib/action-utils";

const P = "/admin/settings";
const done = (tab: string, ok = "تم الحفظ") => {
  revalidatePath("/", "layout");
  flashRedirect(`${P}?tab=${tab}`, { ok });
};

function parseFaq(text: string) {
  // كل سؤال في كتلة منفصلة بسطر فارغ: السطر الأول السؤال وما بعده الجواب
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const [q, ...rest] = b.split("\n");
      return { q: q.replace(/^س\s*[:：]\s*/, "").trim(), a: rest.join("\n").replace(/^ج\s*[:：]\s*/, "").trim() };
    });
}

export async function saveStore(fd: FormData) {
  const u = await requireUser("settings.manage");
  const before = await getSettings();
  let logoUrl = before.logoUrl;
  try {
    const up = await saveUpload(fd.get("logo") as File | null, "brand");
    if (up) logoUrl = up;
  } catch (e) {
    flashRedirect(`${P}?tab=store`, { err: (e as Error).message });
  }
  if (bool(fd, "removeLogo")) logoUrl = "";
  const color = str(fd, "brandColor");
  const after = await saveSettings({
    storeName: str(fd, "storeName") || "قرار",
    tagline: str(fd, "tagline"),
    taglineEn: str(fd, "taglineEn"),
    addressEn: str(fd, "addressEn"),
    workingHoursEn: str(fd, "workingHoursEn"),
    heroTitleEn: str(fd, "heroTitleEn"),
    heroTextEn: str(fd, "heroTextEn"),
    logoUrl,
    brandColor: /^#[0-9a-f]{6}$/i.test(color) ? color : before.brandColor,
    phone: str(fd, "phone"),
    whatsapp: str(fd, "whatsapp"),
    email: str(fd, "email"),
    address: str(fd, "address"),
    workingHours: str(fd, "workingHours"),
    facebook: str(fd, "facebook"),
    instagram: str(fd, "instagram"),
    heroTitle: str(fd, "heroTitle"),
    heroText: str(fd, "heroText"),
  });
  await audit(u.id, "update", "Settings", "store", before, after);
  done("store");
}

export async function saveContent(fd: FormData) {
  const u = await requireUser("settings.manage");
  const before = await getSettings();
  const after = await saveSettings({
    purchasePolicy: str(fd, "purchasePolicy"),
    returnPolicy: str(fd, "returnPolicy"),
    faq: parseFaq(str(fd, "faq")),
    purchasePolicyEn: str(fd, "purchasePolicyEn"),
    returnPolicyEn: str(fd, "returnPolicyEn"),
    faqEn: parseFaq(str(fd, "faqEn")),
  });
  await audit(u.id, "update", "Settings", "content", { purchasePolicy: before.purchasePolicy, returnPolicy: before.returnPolicy, faq: before.faq }, after);
  done("content");
}

export async function savePricing(fd: FormData) {
  const u = await requireUser("settings.manage");
  const before = await getSettings();
  const after = await saveSettings({
    importDepositPercent: Math.min(100, Math.max(0, num(fd, "importDepositPercent"))),
    priceRoundTo: Math.max(0, num(fd, "priceRoundTo")),
    minMarginPercentAlert: Math.max(0, num(fd, "minMarginPercentAlert")),
  });
  await audit(u.id, "update", "Settings", "pricing", before, after);
  done("pricing");
}

export async function savePaymentMethod(fd: FormData) {
  const u = await requireUser("settings.manage");
  const id = str(fd, "id");
  const before = await db.paymentMethod.findUnique({ where: { id } });
  const data = { name: str(fd, "name") || before?.name || "", nameEn: str(fd, "nameEn"), instructions: str(fd, "instructions"), instructionsEn: str(fd, "instructionsEn"), enabled: bool(fd, "enabled"), sortOrder: num(fd, "sortOrder") };
  await db.paymentMethod.update({ where: { id }, data });
  await audit(u.id, "update", "PaymentMethod", id, before, data);
  done("payments");
}

export async function saveCity(fd: FormData) {
  const u = await requireUser("settings.manage");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) flashRedirect(`${P}?tab=cities`, { err: "اسم المدينة مطلوب" });
  const dup = await db.city.findFirst({ where: { name, NOT: id ? { id } : undefined } });
  if (dup) flashRedirect(`${P}?tab=cities`, { err: "المدينة موجودة" });
  const data = {
    name,
    nameEn: str(fd, "nameEn"),
    active: bool(fd, "active"),
    coveredByNawras: bool(fd, "coveredByNawras"),
    deliveryFee: new Prisma.Decimal(Math.max(0, num(fd, "deliveryFee")).toFixed(2)),
    sortOrder: num(fd, "sortOrder"),
  };
  const regions = [...new Set(str(fd, "regions").split(/[،,\n]/).map((r) => r.trim()).filter(Boolean))];
  const city = id ? await db.city.update({ where: { id }, data }) : await db.city.create({ data });
  await db.region.deleteMany({ where: { cityId: city.id, name: { notIn: regions } } });
  for (const r of regions) await db.region.upsert({ where: { cityId_name: { cityId: city.id, name: r } }, create: { cityId: city.id, name: r }, update: {} });
  await audit(u.id, id ? "update" : "create", "City", city.id, undefined, { ...data, regions });
  done("cities");
}

export async function addRate(fd: FormData) {
  const u = await requireUser("settings.manage");
  const currency = str(fd, "currency").toUpperCase();
  const rate = num(fd, "rate");
  if (!/^[A-Z]{3}$/.test(currency) || currency === "LYD" || rate <= 0) flashRedirect(`${P}?tab=rates`, { err: "أدخل رمز عملة من 3 أحرف وسعراً صحيحاً" });
  const r = await db.exchangeRate.create({ data: { currency, rateToLyd: new Prisma.Decimal(rate.toFixed(6)), note: str(fd, "note") } });
  await audit(u.id, "create", "ExchangeRate", r.id, undefined, r);
  done("rates", "تم تسجيل سعر الصرف");
}
