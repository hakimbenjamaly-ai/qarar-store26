import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { deleteCategory, saveCategory } from "./actions";

type Cat = Awaited<ReturnType<typeof load>>[number];
const load = () => db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });

function CatForm({ c, parents }: { c?: Cat; parents: Cat[] }) {
  return (
    <form action={saveCategory} className="grid items-end gap-2 text-sm sm:grid-cols-[1.3fr_1.2fr_1fr_1.2fr_70px_1fr_auto_auto]">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input name="name" defaultValue={c?.name} required placeholder="اسم القسم" className="input" aria-label="الاسم" />
      <input name="nameEn" defaultValue={c?.nameEn} placeholder="الاسم بالإنجليزية" dir="ltr" className="input" aria-label="الاسم بالإنجليزية" />
      <input name="slug" defaultValue={c?.slug} placeholder="الرابط (تلقائي)" dir="ltr" className="input" aria-label="الرابط" />
      <select name="parentId" defaultValue={c?.parentId ?? ""} className="input" aria-label="القسم الرئيسي">
        <option value="">— قسم رئيسي —</option>
        {parents.filter((p) => p.id !== c?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="input" aria-label="الترتيب" title="الترتيب" />
      <input name="image" type="file" accept="image/*" className="text-xs" aria-label="الصورة" />
      <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> ظاهر</label>
      <Submit>{c ? "حفظ" : "إضافة"}</Submit>
    </form>
  );
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("categories.manage");
  const sp = await searchParams;
  const all = await load();
  const roots = all.filter((c) => !c.parentId);
  const ordered = roots.flatMap((r) => [r, ...all.filter((c) => c.parentId === r.id)]);
  const orphans = all.filter((c) => c.parentId && !roots.some((r) => r.id === c.parentId));
  return (
    <div>
      <PageHeader title="الأقسام" />
      <Flash {...sp} />
      <div className="card mb-6 p-4">
        <h2 className="mb-3 font-bold">إضافة قسم</h2>
        <CatForm parents={all} />
      </div>
      <div className="card divide-y">
        {[...ordered, ...orphans].map((c) => (
          <div key={c.id} className={`flex flex-col gap-2 p-3 ${c.parentId ? "bg-gray-50 pr-8" : ""}`}>
            <div className="flex items-center gap-3 text-sm">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <span className="font-medium">{c.parentId ? "↳ " : ""}{c.name}</span>
              <span className="text-gray-500">{c._count.products} منتج</span>
              {!c.active && <span className="badge bg-gray-200">مخفي</span>}
              <form action={deleteCategory} className="mr-auto">
                <input type="hidden" name="id" value={c.id} />
                <Submit className="text-xs text-red-600 hover:underline" confirm="اضغط مجدداً للتأكيد">حذف</Submit>
              </form>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-brand-700">تعديل</summary>
              <div className="mt-2"><CatForm c={c} parents={all} /></div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
