import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getDict } from "@/lib/locale";
import { pick } from "@/lib/i18n";
import { ContactForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.footerContact };
}

export default async function ContactPage() {
  const [s, { l, t }] = await Promise.all([getSettings(), getDict()]);
  const wa = s.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g, "").replace(/^0/, "218")}` : "";
  const address = pick(l, s.address, s.addressEn);
  const hours = pick(l, s.workingHours, s.workingHoursEn);
  return (
    <div className="container-x grid max-w-5xl gap-6 py-8 md:grid-cols-[1fr_300px]">
      <div>
        <h1 className="mb-6 text-2xl font-bold">{t.contactTitle}</h1>
        <ContactForm l={l} />
      </div>
      <aside className="card h-fit space-y-3 p-5 text-sm md:mt-14">
        {s.phone && <div>{t.phone}: <a href={`tel:${s.phone}`} dir="ltr" className="font-medium">{s.phone}</a></div>}
        {wa && <a href={wa} className="btn-primary w-full">{t.contactWa}</a>}
        {s.email && <div>{t.email}: {s.email}</div>}
        {address && <div>{t.address}: {address}</div>}
        {hours && <div className="whitespace-pre-line">{t.workingHours}: {hours}</div>}
        {!s.phone && !s.email && !wa && <p className="text-gray-500">{t.contactFormOnly}</p>}
      </aside>
    </div>
  );
}
