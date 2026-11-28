import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Submit } from "./submit";
import { deleteAttachment, uploadAttachment } from "@/app/admin/(panel)/attachment-actions";

const KINDS = { invoice: "فاتورة", waybill: "بوليصة شحن", receipt: "إيصال", packing: "قائمة تعبئة", signed: "كشف موقّع", other: "أخرى" } as const;

export async function Attachments({ entity, entityId, back, canEdit }: { entity: string; entityId: string; back: string; canEdit: boolean }) {
  const rows = await db.attachment.findMany({ where: { entity, entityId }, orderBy: { createdAt: "desc" } });
  return (
    <section className="card p-4 text-sm">
      <h2 className="mb-3 font-bold">المرفقات</h2>
      <ul className="mb-3 divide-y">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="badge bg-gray-100">{KINDS[a.kind as keyof typeof KINDS] ?? a.kind}</span>
            <a href={a.url} target="_blank" className="text-brand-700 underline">{a.name}</a>
            <span className="text-xs text-gray-400">{dateTime(a.createdAt)}</span>
            {canEdit && (
              <form action={deleteAttachment} className="mr-auto">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="back" value={back} />
                <Submit className="text-xs text-red-600" confirm="تأكيد الحذف؟">حذف</Submit>
              </form>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="py-2 text-gray-500">لا توجد مرفقات.</li>}
      </ul>
      {canEdit && (
        <form action={uploadAttachment} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="back" value={back} />
          <select name="kind" className="input w-36">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="name" placeholder="اسم الملف (اختياري)" className="input w-48" />
          <input name="file" type="file" required accept="image/*,application/pdf" className="text-xs" />
          <Submit className="btn-outline">رفع</Submit>
        </form>
      )}
    </section>
  );
}
