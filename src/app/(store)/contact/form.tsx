"use client";

import { useActionState } from "react";
import { sendContact } from "./actions";
import { dict, type Locale } from "@/lib/i18n";

export function ContactForm({ l }: { l: Locale }) {
  const t = dict(l);
  const [state, action, pending] = useActionState(sendContact, null);
  if (state?.ok) return <div className="card p-6 text-emerald-700">{state.msg}</div>;
  return (
    <form action={action} className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">{t.nameReq}</label><input id="name" name="name" required className="input" /></div>
        <div><label className="label" htmlFor="phone">{t.phoneReq}</label><input id="phone" name="phone" required dir="ltr" className="input rtl:text-right" /></div>
      </div>
      <div><label className="label" htmlFor="subject">{t.subject}</label><input id="subject" name="subject" className="input" /></div>
      <div><label className="label" htmlFor="message">{t.messageReq}</label><textarea id="message" name="message" required rows={5} className="input" /></div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.msg}</p>}
      <button disabled={pending} className="btn-primary">{t.send}</button>
    </form>
  );
}
