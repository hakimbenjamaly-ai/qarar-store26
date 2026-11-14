import "server-only";
import { cache } from "react";
import { db } from "./db";

export type StoreSettings = {
  storeName: string;
  tagline: string;
  logoUrl: string;
  brandColor: string; // لون العلامة الرئيسي بصيغة #RRGGBB
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  workingHours: string;
  facebook: string;
  instagram: string;
  heroTitle: string;
  heroText: string;
  purchasePolicy: string;
  returnPolicy: string;
  faq: { q: string; a: string }[];
  importDepositPercent: number; // نسبة العربون على البنود المستوردة (0 = بدون عربون)
  priceRoundTo: number;
  minMarginPercentAlert: number;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "قرار",
  tagline: "",
  logoUrl: "",
  brandColor: "#0d6e5c",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  workingHours: "",
  facebook: "",
  instagram: "",
  heroTitle: "قرار",
  heroText: "",
  purchasePolicy: "",
  returnPolicy: "",
  faq: [],
  importDepositPercent: 0,
  priceRoundTo: 0.5,
  minMarginPercentAlert: 15,
};

export const getSettings = cache(async (): Promise<StoreSettings> => {
  const row = await db.setting.findUnique({ where: { key: "store" } });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<StoreSettings>) ?? {}) };
});

export async function saveSettings(patch: Partial<StoreSettings>) {
  const current = await getSettings();
  const value = { ...current, ...patch };
  await db.setting.upsert({ where: { key: "store" }, create: { key: "store", value }, update: { value } });
  return value;
}

/** آخر سعر صرف مسجل لكل عملة */
export async function latestRates(): Promise<Record<string, number>> {
  const rows = await db.exchangeRate.findMany({ orderBy: { createdAt: "desc" } });
  const out: Record<string, number> = { LYD: 1 };
  for (const r of rows) if (!(r.currency in out)) out[r.currency] = Number(r.rateToLyd);
  return out;
}

/** يحوّل لون العلامة إلى متغيرات CSS بدرجات فاتحة وغامقة */
export function brandVars(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "";
  const n = parseInt(m[1], 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mix = (t: number, to: number) => rgb.map((c) => Math.round(c + (to - c) * t)).join(" ");
  return `:root{--brand-50:${mix(0.93, 255)};--brand-100:${mix(0.82, 255)};--brand-600:${rgb.join(" ")};--brand-700:${mix(0.2, 0)};--brand-900:${mix(0.55, 0)};}`;
}
