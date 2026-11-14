import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { CheckoutForm } from "./form";

export const metadata = { title: "إتمام الطلب" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [cities, methods, s] = await Promise.all([
    db.city.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { regions: { orderBy: { name: "asc" } } } }),
    db.paymentMethod.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-2xl font-bold">إتمام الطلب</h1>
      {cities.length === 0 || methods.length === 0 ? (
        <div className="card p-8 text-center text-gray-600">استقبال الطلبات غير متاح حالياً. يرجى التواصل معنا{s.phone ? ` على ${s.phone}` : ""}.</div>
      ) : (
        <CheckoutForm
          cities={cities.map((c) => ({ id: c.id, name: c.name, fee: Number(c.deliveryFee), regions: c.regions.map((r) => r.name) }))}
          methods={methods.map((m) => ({ id: m.id, name: m.name, instructions: m.instructions }))}
          depositPercent={s.importDepositPercent}
        />
      )}
    </div>
  );
}
