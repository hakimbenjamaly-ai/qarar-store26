import "server-only";
import { cookies } from "next/headers";
import { dict, isLocale, LOCALE_COOKIE, type Locale } from "./i18n";

/** لغة الزائر من ملف تعريف الارتباط؛ العربية افتراضياً */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "ar";
}

export async function getDict() {
  const l = await getLocale();
  return { l, t: dict(l) };
}
