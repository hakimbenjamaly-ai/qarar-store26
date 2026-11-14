import { getSettings } from "@/lib/settings";

export const metadata = { title: "سياسة الشراء والاستبدال والاسترجاع" };

export default async function PoliciesPage() {
  const s = await getSettings();
  return (
    <div className="container-x max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-bold">سياسة الشراء والاستبدال والاسترجاع</h1>
      <section className="card p-6">
        <h2 className="mb-3 text-lg font-bold">سياسة الشراء</h2>
        <div className="prose-ar">{s.purchasePolicy || "لم تُنشر السياسة بعد."}</div>
      </section>
      <section className="card p-6">
        <h2 className="mb-3 text-lg font-bold">الاستبدال والاسترجاع</h2>
        <div className="prose-ar">{s.returnPolicy || "لم تُنشر السياسة بعد."}</div>
      </section>
    </div>
  );
}
