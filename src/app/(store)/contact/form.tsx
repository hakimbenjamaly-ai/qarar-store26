"use client";

import { useActionState } from "react";
import { sendContact } from "./actions";

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContact, null);
  if (state?.ok) return <div className="card p-6 text-emerald-700">{state.msg}</div>;
  return (
    <form action={action} className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">الاسم *</label><input id="name" name="name" required className="input" /></div>
        <div><label className="label" htmlFor="phone">رقم الهاتف *</label><input id="phone" name="phone" required dir="ltr" className="input text-right" /></div>
      </div>
      <div><label className="label" htmlFor="subject">الموضوع</label><input id="subject" name="subject" className="input" /></div>
      <div><label className="label" htmlFor="message">الرسالة *</label><textarea id="message" name="message" required rows={5} className="input" /></div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.msg}</p>}
      <button disabled={pending} className="btn-primary">إرسال</button>
    </form>
  );
}
