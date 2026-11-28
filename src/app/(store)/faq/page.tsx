import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getDict } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.faqTitle };
}

export default async function FaqPage() {
  const [s, { l, t }] = await Promise.all([getSettings(), getDict()]);
  const faq = l === "en" && s.faqEn.length > 0 ? s.faqEn : s.faq;
  return (
    <div className="container-x max-w-3xl py-8">
      <h1 className="mb-6 text-2xl font-bold">{t.faqTitle}</h1>
      {faq.length === 0 ? (
        <div className="card p-6 text-gray-600">{t.faqEmpty}</div>
      ) : (
        <div className="space-y-3">
          {faq.map((f, i) => (
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
