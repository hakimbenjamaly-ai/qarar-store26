import { getSettings } from "@/lib/settings";
import { ContactForm } from "./form";

export const metadata = { title: "اتصل بنا" };

export default async function ContactPage() {
  const s = await getSettings();
  const wa = s.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g, "").replace(/^0/, "218")}` : "";
  return (
    <div className="container-x grid max-w-5xl gap-6 py-8 md:grid-cols-[1fr_300px]">
      <div>
        <h1 className="mb-6 text-2xl font-bold">اتصل بنا وخدمة العملاء</h1>
        <ContactForm />
      </div>
      <aside className="card h-fit space-y-3 p-5 text-sm md:mt-14">
        {s.phone && <div>الهاتف: <a href={`tel:${s.phone}`} dir="ltr" className="font-medium">{s.phone}</a></div>}
        {wa && <a href={wa} className="btn-primary w-full">تواصل عبر واتساب</a>}
        {s.email && <div>البريد: {s.email}</div>}
        {s.address && <div>العنوان: {s.address}</div>}
        {s.workingHours && <div className="whitespace-pre-line">أوقات العمل: {s.workingHours}</div>}
        {!s.phone && !s.email && !wa && <p className="text-gray-500">يمكنك مراسلتنا عبر النموذج.</p>}
      </aside>
    </div>
  );
}
