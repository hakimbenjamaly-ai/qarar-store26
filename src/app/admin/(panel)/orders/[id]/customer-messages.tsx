"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logCustomerMessage } from "../actions";

type Tpl = { key: string; label: string; body: string };

/**
 * يجهّز رسالة للعميل ويفتح واتساب أو تطبيق الرسائل على جهاز الموظف.
 * الإرسال الفعلي يتم يدوياً من التطبيق؛ هنا نسجّل فقط أن الرسالة فُتحت.
 */
export function CustomerMessages({ orderId, templates, waPhone, smsPhone, dir }: { orderId: string; templates: Tpl[]; waPhone: string; smsPhone: string; dir: "rtl" | "ltr" }) {
  const [key, setKey] = useState(templates[0]?.key ?? "");
  const [body, setBody] = useState(templates[0]?.body ?? "");
  const [, start] = useTransition();
  const router = useRouter();
  const wa = `https://wa.me/${waPhone}?text=${encodeURIComponent(body)}`;
  const sms = `sms:+${smsPhone}?body=${encodeURIComponent(body)}`;
  const log = (channel: "whatsapp" | "sms") =>
    start(async () => {
      await logCustomerMessage({ orderId, template: key, channel, body });
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <select
        aria-label="القالب"
        className="input"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setBody(templates.find((t) => t.key === e.target.value)?.body ?? "");
        }}
      >
        {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      <textarea aria-label="نص الرسالة" dir={dir} className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex gap-2">
        <a href={wa} target="_blank" rel="noopener" onClick={() => log("whatsapp")} className="btn-primary flex-1 text-center">فتح واتساب</a>
        <a href={sms} onClick={() => log("sms")} className="btn-outline flex-1 text-center">رسالة SMS</a>
      </div>
    </div>
  );
}
