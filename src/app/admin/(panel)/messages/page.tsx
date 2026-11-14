import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/admin/ui";

async function toggle(fd: FormData) {
  "use server";
  await requireUser("messages.manage");
  const id = String(fd.get("id"));
  const m = await db.contactMessage.findUnique({ where: { id } });
  if (m) await db.contactMessage.update({ where: { id }, data: { handled: !m.handled } });
  revalidatePath("/admin/messages");
}

export default async function MessagesPage() {
  await requireUser("messages.manage");
  const rows = await db.contactMessage.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 200 });
  return (
    <div>
      <PageHeader title="رسائل العملاء" />
      {rows.length === 0 ? <Empty>لا توجد رسائل.</Empty> : (
        <div className="card divide-y">
          {rows.map((m) => (
            <div key={m.id} className={`p-4 text-sm ${m.handled ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <b>{m.name}</b>
                <a href={`tel:${m.phone}`} dir="ltr">{m.phone}</a>
                <a href={`https://wa.me/218${m.phone.slice(1)}`} target="_blank" className="text-brand-700">واتساب</a>
                <span className="text-gray-500">{dateTime(m.createdAt)}</span>
                <form action={toggle} className="mr-auto"><input type="hidden" name="id" value={m.id} /><button className="btn-outline py-1">{m.handled ? "إعادة فتح" : "تمت المعالجة"}</button></form>
              </div>
              {m.subject && <div className="mt-1 font-medium">{m.subject}</div>}
              <p className="mt-1 whitespace-pre-line text-gray-700">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
