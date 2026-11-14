"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card w-full max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-bold">تسجيل دخول الإدارة</h1>
      <div>
        <label className="label" htmlFor="email">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required dir="ltr" className="input" autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="password">كلمة المرور</label>
        <input id="password" name="password" type="password" required dir="ltr" className="input" autoComplete="current-password" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "..." : "دخول"}</button>
    </form>
  );
}
