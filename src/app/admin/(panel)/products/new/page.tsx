import { requireUser } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/admin/ui";
import { ProductForm } from "../form";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const u = await requireUser("products.manage");
  return (
    <div>
      <PageHeader title="منتج جديد" back="/admin/products" />
      <Flash {...await searchParams} />
      <ProductForm user={u} />
    </div>
  );
}
