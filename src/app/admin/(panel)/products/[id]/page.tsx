import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { ProductForm, loadProduct } from "../form";
import { deleteProduct } from "../actions";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const u = await requireUser("products.manage");
  const p = await loadProduct((await params).id);
  if (!p) notFound();
  return (
    <div>
      <PageHeader
        title={p.name}
        back="/admin/products"
        actions={
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={p.id} />
            <Submit className="btn-danger" confirm="اضغط مجدداً لتأكيد الحذف">حذف المنتج</Submit>
          </form>
        }
      />
      <Flash {...await searchParams} />
      <ProductForm user={u} p={p} />
    </div>
  );
}
