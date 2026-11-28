import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const TABS = [
  { href: "/admin/delivery", label: "جاهز للتجهيز" },
  { href: "/admin/delivery/list", label: "التوصيلات" },
  { href: "/admin/delivery/handovers", label: "دفعات التسليم" },
  { href: "/admin/delivery/import", label: "استيراد حالات النورس" },
  { href: "/admin/delivery/settlements", label: "التسويات" },
  { href: "/admin/delivery/returns", label: "المرتجعات" },
  { href: "/admin/delivery/partners", label: "الشركة والنقاط" },
];

export async function DeliveryTabs({ active }: { active: string }) {
  const u = await getCurrentUser();
  const tabs = TABS.filter((t) => (t.href.includes("settlements") ? u?.permissions.has("payments.manage") : u?.permissions.has("delivery.manage")));
  return (
    <nav className="no-print mb-5 flex gap-1 overflow-x-auto border-b text-sm">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`shrink-0 border-b-2 px-3 py-2 ${active === t.href ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-gray-600 hover:text-brand-700"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
