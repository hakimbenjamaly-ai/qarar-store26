import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/admin/ui";

async function markAll() {
  "use server";
  await requireUser("orders.view");
  await db.notification.updateMany({ where: { read: false }, data: { read: true } });
  revalidatePath("/admin", "layout");
}

export default async function NotificationsPage() {
  const u = await requireUser();
  if (u.permissions.has("delivery.partner") && !u.permissions.has("orders.view")) redirect("/admin/partner");
  const rows = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div>
      <PageHeader title="الإشعارات" actions={<form action={markAll}><button className="btn-outline">تعليم الكل كمقروء</button></form>} />
      <p className="mb-4 text-sm text-gray-500">إشعارات داخل لوحة التحكم. الإرسال عبر واتساب أو SMS أو البريد يُضاف في المرحلة ٤ حسب الخدمة المتاحة.</p>
      {rows.length === 0 ? <Empty>لا توجد إشعارات.</Empty> : (
        <ul className="card divide-y text-sm">
          {rows.map((n) => (
            <li key={n.id} className={`flex flex-wrap gap-3 p-3 ${n.read ? "text-gray-500" : "font-medium"}`}>
              {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-red-600" />}
              {n.link ? <Link href={n.link} className="hover:text-brand-700">{n.title}</Link> : <span>{n.title}</span>}
              {n.body && <span className="text-gray-500">{n.body}</span>}
              <span className="mr-auto text-xs text-gray-400">{dateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
