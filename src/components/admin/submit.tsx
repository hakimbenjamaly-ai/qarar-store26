"use client";

import { useFormStatus } from "react-dom";

export function Submit({ children, className = "btn-primary", confirm }: { children: React.ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={className}
      onClick={(e) => {
        // تأكيد داخل الصفحة لعمليات الحذف (بدون نوافذ المتصفح المنبثقة)
        if (confirm) {
          const btn = e.currentTarget;
          if (btn.dataset.armed !== "1") {
            e.preventDefault();
            btn.dataset.armed = "1";
            btn.dataset.label = btn.textContent ?? "";
            btn.textContent = confirm;
            setTimeout(() => {
              btn.dataset.armed = "";
              btn.textContent = btn.dataset.label ?? "";
            }, 4000);
          }
        }
      }}
    >
      {pending ? "جارٍ الحفظ..." : children}
    </button>
  );
}
