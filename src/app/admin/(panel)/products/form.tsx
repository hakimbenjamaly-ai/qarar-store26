import Link from "next/link";
import { db } from "@/lib/db";
import { can, type CurrentUser } from "@/lib/auth";
import { getSettings, latestRates } from "@/lib/settings";
import { Field } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { VariantsEditor } from "@/components/admin/variants-editor";
import { emptyVariant, type VariantRow } from "@/lib/variant-row";
import { saveProduct } from "./actions";

type Loaded = NonNullable<Awaited<ReturnType<typeof loadProduct>>>;
export const loadProduct = (id: string) =>
  db.product.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { createdAt: "asc" }, include: { cost: true } } } });

export async function ProductForm({ user, p }: { user: CurrentUser; p?: Loaded }) {
  const showCosts = can(user, "costs.view");
  const [cats, suppliers, rates, s] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }], include: { parent: true } }),
    showCosts ? db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [],
    latestRates(),
    getSettings(),
  ]);
  const local = p?.sourcingType === "LOCAL_STOCK";
  const blank = emptyVariant().cost;
  const rows: VariantRow[] = (p?.variants ?? []).map((v) => ({
    id: v.id,
    sku: v.sku,
    name: v.name,
    nameEn: v.nameEn,
    size: v.size ?? "",
    color: v.color ?? "",
    price: String(v.price),
    compareAtPrice: v.compareAtPrice ? String(v.compareAtPrice) : "",
    stockQty: String(v.stockQty),
    active: v.active,
    // لا تُرسل التكاليف للمتصفح إلا لمن لديه صلاحية رؤيتها
    cost:
      showCosts && v.cost
        ? {
            purchasePrice: String(v.cost.purchasePrice),
            purchaseCurrency: v.cost.purchaseCurrency,
            shippingCost: String(v.cost.shippingCost),
            shippingCurrency: v.cost.shippingCurrency,
            otherFeesLyd: String(v.cost.otherFeesLyd),
            localDeliveryLyd: String(v.cost.localDeliveryLyd),
            marginType: v.cost.marginType,
            marginValue: String(v.cost.marginValue),
          }
        : blank,
  }));
  const supplierId = p?.variants.find((v) => v.cost?.supplierId)?.cost?.supplierId ?? "";
  const specsText = Array.isArray(p?.specs) ? (p!.specs as { label: string; value: string }[]).map((x) => (x.value ? `${x.label}: ${x.value}` : x.label)).join("\n") : "";

  return (
    <form action={saveProduct} className="space-y-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <Field label="اسم المنتج *"><input name="name" defaultValue={p?.name} required className="input" /></Field>
        <Field label="الاسم بالإنجليزية" hint="يظهر لمن يختار الإنجليزية؛ إن تُرك فارغاً يظهر الاسم العربي"><input name="nameEn" defaultValue={p?.nameEn} dir="ltr" className="input" /></Field>
        <Field label="رمز المنتج SKU *"><input name="sku" defaultValue={p?.sku} required dir="ltr" className="input" /></Field>
        <Field label="رابط الصفحة" hint="يُنشأ تلقائياً من الاسم إن تُرك فارغاً"><input name="slug" defaultValue={p?.slug} dir="ltr" className="input" /></Field>
        <Field label="القسم *">
          <select name="categoryId" defaultValue={p?.categoryId ?? ""} required className="input">
            <option value="">اختر القسم</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.parent ? `${c.parent.name} ← ` : ""}{c.name}</option>)}
          </select>
        </Field>
        <Field label="بلد المنشأ"><input name="countryOfOrigin" defaultValue={p?.countryOfOrigin ?? ""} className="input" /></Field>
        <Field label="نوع التوفير">
          <select name="sourcingType" defaultValue={p?.sourcingType ?? "IMPORT_ON_ORDER"} className="input">
            <option value="IMPORT_ON_ORDER">استيراد عند الطلب</option>
            <option value="LOCAL_STOCK">متوفر محلياً (مخزون في ليبيا)</option>
          </select>
        </Field>
        <Field label="مدة التوريد التقديرية (أيام)"><input name="leadTimeDays" type="number" min={0} defaultValue={p?.leadTimeDays ?? ""} className="input" /></Field>
        <Field label="الوصف التفصيلي"><textarea name="description" rows={5} defaultValue={p?.description} className="input" /></Field>
        <Field label="الوصف بالإنجليزية"><textarea name="descriptionEn" rows={5} defaultValue={p?.descriptionEn} dir="ltr" className="input" /></Field>
        <Field label="المواصفات الفنية" hint="سطر لكل مواصفة بصيغة: الاسم: القيمة" className="md:col-span-2">
          <textarea name="specs" rows={4} defaultValue={specsText} className="input" placeholder={"الخامة: قطن\nالوزن: 300 غ"} />
        </Field>
        <div className="flex gap-6 md:col-span-2">
          <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={p?.published ?? false} /> منشور في المتجر</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={p?.featured ?? false} /> يظهر في «مختارات»</label>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">الصور</h2>
        {p && p.images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {p.images.map((img) => (
              <div key={img.id} className="w-28 space-y-1 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-28 w-28 rounded-lg border object-cover" />
                <input name={`imgOrder_${img.id}`} type="number" defaultValue={img.sortOrder} className="input py-1" title="الترتيب" aria-label="الترتيب" />
                <label className="flex items-center gap-1 text-red-600"><input type="checkbox" name="removeImage" value={img.id} /> حذف</label>
              </div>
            ))}
          </div>
        )}
        <Field label="رفع صور جديدة" hint="JPG / PNG / WEBP حتى 8 ميغابايت للصورة"><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" /></Field>
        <Field label="أو روابط صور (سطر لكل رابط)"><textarea name="imageUrls" rows={2} dir="ltr" className="input" /></Field>
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">الأسعار والخيارات{showCosts ? " والتكاليف الداخلية" : ""}</h2>
          {showCosts && (
            <label className="flex items-center gap-2 text-sm">المورد
              <select name="supplierId" defaultValue={supplierId} className="input w-56">
                <option value="">— بدون —</option>
                {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}{x.platform ? ` (${x.platform})` : ""}</option>)}
              </select>
              <Link href="/admin/suppliers" className="text-xs text-brand-700 hover:underline" target="_blank">إدارة الموردين</Link>
            </label>
          )}
        </div>
        {showCosts && <p className="text-xs text-gray-500">التكاليف وهامش الربح والمورد بيانات داخلية لا تظهر للعملاء. الكمية المتاحة تُستخدم فقط للمنتجات المتوفرة محلياً.</p>}
        <VariantsEditor initial={rows} rates={rates} roundTo={s.priceRoundTo} showCosts={showCosts} local={local || !p} baseSku={p?.sku ?? ""} />
      </section>

      <div className="flex gap-3">
        <Submit>حفظ المنتج</Submit>
        {p?.published && <Link href={`/product/${encodeURIComponent(p.slug)}`} target="_blank" className="btn-outline">عرض في المتجر ↗</Link>}
      </div>
    </form>
  );
}
