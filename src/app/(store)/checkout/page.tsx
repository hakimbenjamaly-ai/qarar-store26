import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getDict } from "@/lib/locale";
import { pick } from "@/lib/i18n";
import { CheckoutForm } from "./form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.checkout };
}

export default async function CheckoutPage() {
  const [cities, methods, s, { l, t }] = await Promise.all([
    db.city.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { regions: { orderBy: { name: "asc" } } } }),
    db.paymentMethod.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
    getDict(),
  ]);
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-2xl font-bold">{t.checkout}</h1>
      {cities.length === 0 || methods.length === 0 ? (
        <div className="card p-8 text-center text-gray-600">{t.ordersClosed(s.phone)}</div>
      ) : (
        <CheckoutForm
          cities={cities.map((c) => ({ id: c.id, name: pick(l, c.name, c.nameEn), fee: Number(c.deliveryFee), regions: c.regions.map((r) => r.name) }))}
          methods={methods.map((m) => ({ id: m.id, name: pick(l, m.name, m.nameEn), instructions: pick(l, m.instructions, m.instructionsEn) }))}
          depositPercent={s.importDepositPercent}
        />
      )}
    </div>
  );
}
