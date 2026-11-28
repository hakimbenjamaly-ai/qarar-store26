import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Field, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { addRate, saveCity, saveContent, saveNotifications, savePaymentMethod, savePricing, saveStore, saveTemplates, sendTestEmail } from "./actions";
import { EMAIL_EVENTS, smtpConfigured } from "@/lib/notify";
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, TEMPLATE_LABELS } from "@/lib/messages";

const TABS = [
  ["store", "بيانات المتجر"],
  ["content", "السياسات والأسئلة"],
  ["payments", "طرق الدفع"],
  ["cities", "المدن ورسوم التوصيل"],
  ["rates", "أسعار الصرف"],
  ["pricing", "التسعير والعربون"],
  ["notifications", "إشعارات البريد"],
  ["templates", "قوالب رسائل العملاء"],
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  await requireUser("settings.manage");
  const sp = await searchParams;
  const tab = sp.tab ?? "store";
  const s = await getSettings();

  return (
    <div>
      <PageHeader title="إعدادات المتجر" />
      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`?tab=${k}`} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-gray-600"}`}>{label}</Link>
        ))}
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      {tab === "store" && (
        <form action={saveStore} className="card grid gap-4 p-5 md:grid-cols-2">
          <Field label="اسم المتجر"><input name="storeName" defaultValue={s.storeName} className="input" /></Field>
          <Field label="الشعار النصي (يظهر أسفل الموقع)"><input name="tagline" defaultValue={s.tagline} className="input" /></Field>
          <Field label="الشعار النصي بالإنجليزية"><input name="taglineEn" defaultValue={s.taglineEn} dir="ltr" className="input" /></Field>
          <Field label="الشعار (صورة)" hint="PNG أو SVG بخلفية شفافة يفضَّل">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.logoUrl && <img src={s.logoUrl} alt="" className="h-12 rounded border bg-white p-1" />}
              <input name="logo" type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="text-sm" />
            </div>
            {s.logoUrl && <label className="mt-1 flex items-center gap-1 text-xs text-red-600"><input type="checkbox" name="removeLogo" /> إزالة الشعار</label>}
          </Field>
          <Field label="لون العلامة" hint="اختر اللون الرئيسي من شعارك"><input name="brandColor" type="color" defaultValue={s.brandColor} className="h-10 w-24 rounded border" /></Field>
          <Field label="الهاتف"><input name="phone" defaultValue={s.phone} dir="ltr" className="input" /></Field>
          <Field label="واتساب"><input name="whatsapp" defaultValue={s.whatsapp} dir="ltr" className="input" /></Field>
          <Field label="البريد الإلكتروني"><input name="email" defaultValue={s.email} dir="ltr" className="input" /></Field>
          <Field label="العنوان"><input name="address" defaultValue={s.address} className="input" /></Field>
          <Field label="العنوان بالإنجليزية"><input name="addressEn" defaultValue={s.addressEn} dir="ltr" className="input" /></Field>
          <Field label="أوقات العمل"><input name="workingHours" defaultValue={s.workingHours} className="input" /></Field>
          <Field label="أوقات العمل بالإنجليزية"><input name="workingHoursEn" defaultValue={s.workingHoursEn} dir="ltr" className="input" /></Field>
          <Field label="فيسبوك"><input name="facebook" defaultValue={s.facebook} dir="ltr" className="input" /></Field>
          <Field label="إنستغرام"><input name="instagram" defaultValue={s.instagram} dir="ltr" className="input" /></Field>
          <Field label="عنوان الواجهة الرئيسية"><input name="heroTitle" defaultValue={s.heroTitle} className="input" /></Field>
          <Field label="عنوان الواجهة بالإنجليزية"><input name="heroTitleEn" defaultValue={s.heroTitleEn} dir="ltr" className="input" /></Field>
          <Field label="نص الواجهة الرئيسية"><textarea name="heroText" defaultValue={s.heroText} rows={2} className="input" /></Field>
          <Field label="نص الواجهة بالإنجليزية"><textarea name="heroTextEn" defaultValue={s.heroTextEn} rows={2} dir="ltr" className="input" /></Field>
          <p className="text-xs text-gray-500 md:col-span-2">الحقول الإنجليزية اختيارية: إن تُركت فارغة يرى زائر النسخة الإنجليزية النص العربي.</p>
          <div><Submit>حفظ</Submit></div>
        </form>
      )}

      {tab === "content" && (
        <form action={saveContent} className="card grid gap-4 p-5 md:grid-cols-2">
          <Field label="سياسة الشراء"><textarea name="purchasePolicy" defaultValue={s.purchasePolicy} rows={6} className="input" /></Field>
          <Field label="سياسة الشراء بالإنجليزية"><textarea name="purchasePolicyEn" defaultValue={s.purchasePolicyEn} rows={6} dir="ltr" className="input" /></Field>
          <Field label="سياسة الاستبدال والاسترجاع"><textarea name="returnPolicy" defaultValue={s.returnPolicy} rows={6} className="input" /></Field>
          <Field label="سياسة الاستبدال والاسترجاع بالإنجليزية"><textarea name="returnPolicyEn" defaultValue={s.returnPolicyEn} rows={6} dir="ltr" className="input" /></Field>
          <Field label="الأسئلة الشائعة" hint="اكتب كل سؤال في سطر وجوابه في السطر التالي، وافصل بين الأسئلة بسطر فارغ">
            <textarea name="faq" defaultValue={s.faq.map((f) => `${f.q}\n${f.a}`).join("\n\n")} rows={12} className="input" />
          </Field>
          <Field label="الأسئلة الشائعة بالإنجليزية" hint="بنفس الصيغة؛ إن تُركت فارغة تظهر الأسئلة العربية">
            <textarea name="faqEn" defaultValue={s.faqEn.map((f) => `${f.q}\n${f.a}`).join("\n\n")} rows={12} dir="ltr" className="input" />
          </Field>
          <div><Submit>حفظ</Submit></div>
        </form>
      )}

      {tab === "payments" && <PaymentsTab />}
      {tab === "cities" && <CitiesTab />}
      {tab === "rates" && <RatesTab />}

      {tab === "pricing" && (
        <form action={savePricing} className="card grid max-w-xl gap-4 p-5">
          <Field label="نسبة العربون على المنتجات المستوردة عند الطلب (%)" hint="0 = بدون عربون"><input name="importDepositPercent" type="number" min={0} max={100} step="1" defaultValue={s.importDepositPercent} className="input" /></Field>
          <Field label="تقريب السعر المقترح لأعلى إلى أقرب (د.ل)" hint="مثال 0.5 أو 1 أو 5. ضع 0 لإلغاء التقريب"><input name="priceRoundTo" type="number" min={0} step="0.01" defaultValue={s.priceRoundTo} className="input" /></Field>
          <Field label="تنبيه عند هامش ربح أقل من (%)"><input name="minMarginPercentAlert" type="number" min={0} defaultValue={s.minMarginPercentAlert} className="input" /></Field>
          <div><Submit>حفظ</Submit></div>
        </form>
      )}

      {tab === "notifications" && <NotificationsTab s={s} />}

      {tab === "templates" && (
        <form action={saveTemplates} className="space-y-4">
          <p className="text-sm text-gray-600">
            تُستخدم هذه القوالب في صفحة الطلب لفتح واتساب أو الرسائل النصية برسالة جاهزة يرسلها الموظف من جهازه. لا يوجد إرسال آلي.
            المتغيرات المتاحة: <code dir="ltr">{"{name} {order} {total} {remaining} {track_link} {store}"}</code>
          </p>
          {TEMPLATE_KEYS.map((k) => (
            <div key={k} className="card grid gap-3 p-4 md:grid-cols-2">
              <div className="font-semibold md:col-span-2">{TEMPLATE_LABELS[k]}</div>
              <Field label="بالعربية"><textarea name={`${k}.ar`} defaultValue={s.templates[k]?.ar || DEFAULT_TEMPLATES[k].ar} rows={3} className="input" /></Field>
              <Field label="بالإنجليزية"><textarea name={`${k}.en`} defaultValue={s.templates[k]?.en || DEFAULT_TEMPLATES[k].en} rows={3} dir="ltr" className="input" /></Field>
            </div>
          ))}
          <Submit>حفظ القوالب</Submit>
        </form>
      )}
    </div>
  );
}

async function NotificationsTab({ s }: { s: Awaited<ReturnType<typeof getSettings>> }) {
  const ok = smtpConfigured();
  const recent = await db.notification.findMany({ where: { emailStatus: { in: ["sent", "failed"] } }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div className="space-y-4">
      <div className={`card p-4 text-sm ${ok ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
        {ok
          ? "البريد مضبوط على الخادم. ستُرسل الإشعارات المختارة أدناه إلى العناوين المحددة."
          : "البريد غير مضبوط بعد: أضف متغيرات SMTP_HOST و SMTP_PORT و SMTP_USER و SMTP_PASS و SMTP_FROM على الخادم (راجع دليل النشر). حتى ذلك الحين تظهر الإشعارات داخل اللوحة فقط."}
      </div>
      <form action={saveNotifications} className="card grid max-w-2xl gap-4 p-5">
        <Field label="بريد الإدارة لاستقبال الإشعارات" hint="يمكن إدخال أكثر من عنوان مفصولة بفواصل">
          <input name="notifyEmails" defaultValue={s.notifyEmails} dir="ltr" className="input" />
        </Field>
        <div>
          <div className="label">الأحداث التي تُرسل بالبريد</div>
          <div className="grid gap-1 sm:grid-cols-2">
            {Object.entries(EMAIL_EVENTS).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`ev_${k}`} defaultChecked={s.emailEvents.includes(k)} /> {label}</label>
            ))}
          </div>
        </div>
        <Field label="تنبيه انخفاض المخزون المحلي عند وصول الكمية إلى" hint="0 = إيقاف التنبيه">
          <input name="lowStockThreshold" type="number" min={0} defaultValue={s.lowStockThreshold} className="input w-32" />
        </Field>
        <div><Submit>حفظ</Submit></div>
      </form>
      {ok && <form action={sendTestEmail}><Submit className="btn-outline">إرسال رسالة تجريبية</Submit></form>}
      {recent.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الإشعار</th><th>حالة البريد</th><th>الوقت</th></tr></thead>
            <tbody>
              {recent.map((n) => (
                <tr key={n.id}><td>{n.title}</td><td>{n.emailStatus === "sent" ? "أُرسل" : `فشل: ${n.emailError ?? ""}`}</td><td>{dateTime(n.emailedAt ?? n.createdAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function PaymentsTab() {
  const methods = await db.paymentMethod.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">طرق الدفع المفعّلة فقط تظهر للعميل عند إتمام الطلب. الدفع الإلكتروني لا يعمل قبل ربط بوابة دفع فعلية، لذا لا تفعّله الآن.</p>
      {methods.map((m) => (
        <form key={m.id} action={savePaymentMethod} className="card grid gap-3 p-4 text-sm md:grid-cols-[180px_1fr_80px_auto_auto]">
          <input type="hidden" name="id" value={m.id} />
          <div className="space-y-2">
            <input name="name" defaultValue={m.name} className="input" aria-label="الاسم" />
            <input name="nameEn" defaultValue={m.nameEn} placeholder="الاسم بالإنجليزية" dir="ltr" className="input" aria-label="الاسم بالإنجليزية" />
          </div>
          <div className="space-y-2">
            <textarea name="instructions" defaultValue={m.instructions} rows={2} placeholder="تعليمات للعميل (مثل بيانات الحساب المصرفي)" className="input" />
            <textarea name="instructionsEn" defaultValue={m.instructionsEn} rows={2} placeholder="التعليمات بالإنجليزية" dir="ltr" className="input" />
          </div>
          <input name="sortOrder" type="number" defaultValue={m.sortOrder} className="input" aria-label="الترتيب" />
          <label className="flex items-center gap-1"><input type="checkbox" name="enabled" defaultChecked={m.enabled} disabled={m.code === "ONLINE"} /> مفعّلة</label>
          <Submit>حفظ</Submit>
        </form>
      ))}
    </div>
  );
}

async function CitiesTab() {
  const cities = await db.city.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }], include: { regions: { orderBy: { name: "asc" } } } });
  const Row = ({ c }: { c?: (typeof cities)[number] }) => (
    <form action={saveCity} className="grid items-center gap-2 p-3 text-sm md:grid-cols-[130px_120px_110px_1fr_70px_auto_auto_auto]">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input name="name" defaultValue={c?.name} required placeholder="المدينة" className="input" aria-label="المدينة" />
      <input name="nameEn" defaultValue={c?.nameEn} placeholder="بالإنجليزية" dir="ltr" className="input" aria-label="المدينة بالإنجليزية" />
      <input name="deliveryFee" defaultValue={c ? String(c.deliveryFee) : ""} inputMode="decimal" placeholder="رسوم التوصيل" className="input" aria-label="رسوم التوصيل" />
      <input name="regions" defaultValue={c?.regions.map((r) => r.name).join("، ")} placeholder="المناطق مفصولة بفاصلة (اختياري)" className="input" aria-label="المناطق" />
      <input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="input" aria-label="الترتيب" />
      <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> متاحة للطلب</label>
      <label className="flex items-center gap-1"><input type="checkbox" name="coveredByNawras" defaultChecked={c?.coveredByNawras ?? false} /> يغطيها النورس</label>
      <Submit className="btn-outline py-1">{c ? "حفظ" : "إضافة"}</Submit>
    </form>
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">المدن المتاحة فقط تظهر للعميل. فعّل المدينة بعد تحديد رسوم التوصيل المتفق عليها مع شركة النورس (الرسوم 0 تظهر للعميل «مجاني»).</p>
      <div className="card"><Row /></div>
      <div className="card divide-y">{cities.map((c) => <Row key={c.id} c={c} />)}</div>
    </div>
  );
}

async function RatesTab() {
  const rows = await db.exchangeRate.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.currency)) latest.set(r.currency, r);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">سعر الصرف = كم ديناراً ليبياً تدفع مقابل وحدة واحدة من العملة، بالسعر الفعلي الذي تشتري به. يُستخدم آخر سعر مسجل في حاسبة الأسعار.</p>
      <form action={addRate} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
        <Field label="العملة"><input name="currency" required maxLength={3} placeholder="USD" dir="ltr" className="input w-24 uppercase" /></Field>
        <Field label="السعر بالدينار"><input name="rate" required inputMode="decimal" className="input w-32" /></Field>
        <Field label="ملاحظة / المصدر"><input name="note" className="input w-64" /></Field>
        <Submit>تسجيل</Submit>
      </form>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...latest.values()].map((r) => (
          <div key={r.id} className="card p-3"><div className="text-sm text-gray-500">{r.currency}</div><div className="text-xl font-bold">{Number(r.rateToLyd)} د.ل</div><div className="text-xs text-gray-400">{dateTime(r.createdAt)}</div></div>
        ))}
        {latest.size === 0 && <p className="text-sm text-gray-500">لم تُسجَّل أسعار صرف بعد.</p>}
      </div>
      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>التاريخ</th><th>العملة</th><th>السعر</th><th>ملاحظة</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td>{dateTime(r.createdAt)}</td><td>{r.currency}</td><td>{Number(r.rateToLyd)}</td><td>{r.note}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
