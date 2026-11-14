import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { dateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/admin/ui";

async function moderate(fd: FormData) {
  "use server";
  const u = await requireUser("products.manage");
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  if (op === "delete") await db.review.delete({ where: { id } });
  else await db.review.update({ where: { id }, data: { approved: op === "approve" } });
  await audit(u.id, `review_${op}`, "Review", id);
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}

export default async function ReviewsPage() {
  await requireUser("products.manage");
  const rows = await db.review.findMany({ orderBy: [{ approved: "asc" }, { createdAt: "desc" }], take: 200, include: { product: { select: { name: true, id: true } }, customer: { select: { fullName: true } } } });
  return (
    <div>
      <PageHeader title="تقييمات العملاء" />
      {rows.length === 0 ? <Empty>لا توجد تقييمات. يقيّم العملاء المنتجات من صفحة متابعة الطلب بعد استلامها.</Empty> : (
        <div className="card divide-y">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
              <div className="flex-1">
                <div><span className="text-amber-500">{"★".repeat(r.rating)}</span> <Link href={`/admin/products/${r.product.id}`} className="font-medium">{r.product.name}</Link> · {r.customer.fullName} · <span className="text-gray-500">{dateTime(r.createdAt)}</span></div>
                {r.body && <p className="mt-1 text-gray-700">{r.body}</p>}
              </div>
              {r.approved ? <span className="badge bg-emerald-100 text-emerald-800">منشور</span> : <span className="badge bg-amber-100 text-amber-800">بانتظار المراجعة</span>}
              <form action={moderate} className="flex gap-2">
                <input type="hidden" name="id" value={r.id} />
                {r.approved
                  ? <button name="op" value="hide" className="btn-outline py-1">إخفاء</button>
                  : <button name="op" value="approve" className="btn-primary py-1">نشر</button>}
                <button name="op" value="delete" className="btn-outline py-1 text-red-600">حذف</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
