"use client";

import { useActionState } from "react";
import { submitReview } from "./actions";

export function ReviewForm({ number, phone, productId }: { number: string; phone: string; productId: string }) {
  const [state, action, pending] = useActionState(submitReview, null);
  if (state?.ok) return <p className="text-sm text-emerald-700">{state.msg}</p>;
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="productId" value={productId} />
      <select name="rating" required className="input w-32" defaultValue="">
        <option value="" disabled>التقييم</option>
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
      </select>
      <input name="body" placeholder="رأيك في المنتج (اختياري)" className="input min-w-48 flex-1" />
      <button disabled={pending} className="btn-outline">إرسال التقييم</button>
      {state && !state.ok && <span className="w-full text-sm text-red-600">{state.msg}</span>}
    </form>
  );
}
