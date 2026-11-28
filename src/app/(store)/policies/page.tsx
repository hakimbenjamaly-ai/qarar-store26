import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getDict } from "@/lib/locale";
import { pick } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.policiesTitle };
}

export default async function PoliciesPage() {
  const [s, { l, t }] = await Promise.all([getSettings(), getDict()]);
  return (
    <div className="container-x max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-bold">{t.policiesTitle}</h1>
      <section className="card p-6">
        <h2 className="mb-3 text-lg font-bold">{t.purchasePolicy}</h2>
        <div className="prose-ar">{pick(l, s.purchasePolicy, s.purchasePolicyEn) || t.policyNotPublished}</div>
      </section>
      <section className="card p-6">
        <h2 className="mb-3 text-lg font-bold">{t.returnPolicy}</h2>
        <div className="prose-ar">{pick(l, s.returnPolicy, s.returnPolicyEn) || t.policyNotPublished}</div>
      </section>
    </div>
  );
}
