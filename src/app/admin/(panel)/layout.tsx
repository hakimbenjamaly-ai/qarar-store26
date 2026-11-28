import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { Permission } from "@/lib/permissions";
import { logout } from "../actions";
import { dispatchEmails } from "@/lib/notify";

const NAV: { href: string; label: string; perm?: Permission }[] = [
  { href: "/admin", label: "لوحة المؤشرات", perm: "dashboard.view" },
  { href: "/admin/orders", label: "الطلبات", perm: "orders.view" },
  { href: "/admin/purchasing", label: "بانتظار الشراء", perm: "purchasing.manage" },
  { href: "/admin/purchase-orders", label: "أوامر الشراء", perm: "purchasing.manage" },
  { href: "/admin/shipments", label: "الشحنات الدولية", perm: "shipping.manage" },
  { href: "/admin/delivery", label: "التوزيع المحلي (النورس)", perm: "delivery.manage" },
  { href: "/admin/delivery/settlements", label: "التسويات مع النورس", perm: "payments.manage" },
  { href: "/admin/partner", label: "بوابة شركة التوزيع", perm: "delivery.partner" },
  { href: "/admin/reports", label: "التقارير", perm: "reports.view" },
  { href: "/admin/expenses", label: "المصروفات", perm: "payments.manage" },
  { href: "/admin/products", label: "المنتجات", perm: "products.manage" },
  { href: "/admin/categories", label: "الأقسام", perm: "categories.manage" },
  { href: "/admin/suppliers", label: "الموردون", perm: "costs.view" },
  { href: "/admin/customers", label: "العملاء", perm: "customers.view" },
  { href: "/admin/reviews", label: "التقييمات", perm: "products.manage" },
  { href: "/admin/messages", label: "رسائل العملاء", perm: "messages.manage" },
  { href: "/admin/notifications", label: "الإشعارات" },
  { href: "/admin/settings", label: "إعدادات المتجر", perm: "settings.manage" },
  { href: "/admin/users", label: "المستخدمون والصلاحيات", perm: "users.manage" },
  { href: "/admin/audit", label: "سجل العمليات", perm: "audit.view" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // إرسال إشعارات البريد المعلّقة في الخلفية (لا يؤخر عرض الصفحة؛ ولا يعمل بدون SMTP)
  void dispatchEmails().catch(() => {});
  const [s, unread] = await Promise.all([getSettings(), db.notification.count({ where: { read: false } })]);
  // موظف شركة التوزيع لا يرى إشعارات المتجر الداخلية
  const partnerOnly = user.permissions.has("delivery.partner") && !user.permissions.has("orders.view");
  const items = NAV.filter((n) => (n.href === "/admin/partner" && !user.deliveryPartnerId ? false : n.perm ? user.permissions.has(n.perm) : !partnerOnly));
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="no-print border-l bg-white lg:min-h-screen">
        <div className="flex items-center justify-between border-b p-4">
          <Link href="/admin" className="text-lg font-bold text-brand-700">{s.storeName} · الإدارة</Link>
          <Link href="/" className="text-xs text-gray-500 hover:underline" target="_blank">المتجر ↗</Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2 text-sm lg:flex-col">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className="flex shrink-0 items-center justify-between rounded-md px-3 py-2 hover:bg-brand-50 hover:text-brand-700">
              {n.label}
              {n.href === "/admin/notifications" && unread > 0 && <span className="badge bg-red-600 text-white">{unread}</span>}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4 text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-gray-500">{user.roleName}</div>
          <form action={logout}><button className="mt-2 text-red-600 hover:underline">تسجيل الخروج</button></form>
        </div>
      </aside>
      <div className="min-w-0 p-4 lg:p-8">{children}</div>
    </div>
  );
}
