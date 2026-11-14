import { getSettings } from "@/lib/settings";

export const metadata = { title: "الأسئلة الشائعة" };

export default async function FaqPage() {
  const s = await getSettings();
  return (
    <div className="container-x max-w-3xl py-8">
      <h1 className="mb-6 text-2xl font-bold">الأسئلة الشائعة</h1>
      {s.faq.length === 0 ? (
        <div className="card p-6 text-gray-600">لم تُضف أسئلة بعد.</div>
      ) : (
        <div className="space-y-3">
          {s.faq.map((f, i) => (
            <details key={i} className="card p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="prose-ar mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
