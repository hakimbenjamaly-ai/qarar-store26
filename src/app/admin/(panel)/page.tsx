import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { lyd } from "@/lib/format";
import { STATUS_LABELS, statusTone } from "@/lib/order-status";
import { PageHeader, Stat } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

function range(from?: string, to?: string) {
  const f = from ? new Date(from + "T00:00:00+02:00") : new Date(Date.now() - 30 * 864e5);
  const t = to ? new Date(to + "T23:59:59+02:00") : new Date();
  return { f, t };
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; category?: string; supplier?: string; denied?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  if (!can(user, "dashboard.view") && can(user, "delivery.partner") && !sp.denied) redirect("/admin/partner");
  if (!can(user, "dashboard.view")) {
    return (
      <div>
        <PageHeader title={`مرحباً ${user.name}`} />
        {sp.denied && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">ليست لديك صلاحية لفتح تلك الصفحة.</p>}
        <p className="text-gray-600">استخدم القائمة للوصول إلى الأقسام المتاحة لك.</p>
      </div>
    );
  }
  const { f, t } = range(sp.from, sp.to);
  const showCosts = can(user, "costs.view");
  const [categories, suppliers] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const orderWhere: Prisma.OrderWhereInput = { createdAt: { gte: f, lte: t } };
  // فلتر البند: القسم و/أو المورد (من أمر الشراء الفعلي، أو المورد المسجل على المنتج)
  const itemFilter: Prisma.OrderItemWhereInput = {};
  if (sp.category) itemFilter.variant = { product: { categoryId: sp.category } };
  if (sp.supplier)
    itemFilter.OR = [
      { purchaseItems: { some: { purchaseOrder: { supplierId: sp.supplier, status: { not: "CANCELLED" } } } } },
      { purchaseItems: { none: {} }, variant: { cost: { supplierId: sp.supplier } } },
    ];
  const hasItemFilter = !!(sp.category || sp.supplier);
  if (hasItemFilter) orderWhere.items = { some: itemFilter };

  const [byStatus, totals, items, recent, lowStock] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: orderWhere, _count: true }),
    db.order.aggregate({ where: { ...orderWhere, status: { notIn: ["CANCELLED"] } }, _sum: { total: true, deliveryFee: true }, _count: true }),
    db.orderItem.findMany({
      where: { order: orderWhere, status: { notIn: ["CANCELLED"] }, ...(hasItemFilter ? itemFilter : {}) },
      select: { quantity: true, unitPrice: true, estUnitCostLyd: true, actualUnitCostLyd: true, status: true, productName: true, variant: { select: { productId: true } } },
    }),
    db.order.findMany({ where: orderWhere, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, shipName: true, total: true, status: true } }),
    db.productVariant.findMany({ where: { active: true, stockQty: { lte: 2 }, product: { sourcingType: "LOCAL_STOCK", published: true } }, take: 8, include: { product: { select: { name: true, id: true } } } }),
  ]);

  // تكاليف المشتريات والشحن الفعلية في الفترة (بالدينار حسب سعر الصرف المسجل)
  const [pos, ships] = showCosts
    ? await Promise.all([
        db.purchaseOrder.findMany({ where: { status: { notIn: ["DRAFT", "CANCELLED"] }, orderedAt: { gte: f, lte: t }, supplierId: sp.supplier || undefined }, select: { total: true, exchangeRate: true, currency: true } }),
        db.shipment.findMany({ where: { status: { not: "CANCELLED" }, createdAt: { gte: f, lte: t } }, select: { cost: true, exchangeRate: true, costCurrency: true, customsFeesLyd: true } }),
      ])
    : [[], []];
  const purchaseCost = pos.reduce((s, p) => s + (p.currency === "LYD" ? Number(p.total) : p.exchangeRate ? Number(p.total) * Number(p.exchangeRate) : 0), 0);
  const posMissingRate = pos.filter((p) => p.currency !== "LYD" && !p.exchangeRate).length;
  const shippingCost = ships.reduce((s, x) => s + (x.costCurrency === "LYD" ? Number(x.cost) : x.exchangeRate ? Number(x.cost) * Number(x.exchangeRate) : 0) + Number(x.customsFeesLyd), 0);

  // التوزيع المحلي: أجور النورس للتوصيلات المنتهية في الفترة، والمبالغ المحصلة غير المسوّاة (كلها)
  const [nawrasFees, pendingCod] = await Promise.all([
    showCosts
      ? db.delivery.aggregate({ where: { status: { in: ["DELIVERED", "RETURNED"] }, updatedAt: { gte: f, lte: t } }, _sum: { fee: true } })
      : null,
    showCosts || can(user, "payments.manage") ? db.delivery.aggregate({ where: { status: "DELIVERED", settlementId: null }, _sum: { collected: true }, _count: true }) : null,
  ]);

  const count = (s: string[]) => byStatus.filter((b) => s.includes(b.status)).reduce((n, b) => n + b._count, 0);
  const allCount = byStatus.reduce((n, b) => n + b._count, 0);
  let revenue = 0, expectedCost = 0, missingCost = 0, deliveredRevenue = 0, deliveredCost = 0, deliveredMissingActual = 0;
  const top = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const i of items) {
    const r = Number(i.unitPrice) * i.quantity;
    revenue += r;
    // الربح المتوقع: التكلفة الفعلية إن عُرفت، وإلا التقديرية
    const unit = i.actualUnitCostLyd ?? i.estUnitCostLyd;
    if (unit !== null) expectedCost += Number(unit) * i.quantity;
    else missingCost++;
    if (i.status === "DELIVERED") {
      deliveredRevenue += r;
      if (i.actualUnitCostLyd !== null) deliveredCost += Number(i.actualUnitCostLyd) * i.quantity;
      else if (i.estUnitCostLyd !== null) {
        deliveredCost += Number(i.estUnitCostLyd) * i.quantity;
        deliveredMissingActual++;
      } else deliveredMissingActual++;
    }
    const tp = top.get(i.variant.productId) ?? { name: i.productName, qty: 0, revenue: 0 };
    tp.qty += i.quantity;
    tp.revenue += r;
    top.set(i.variant.productId, tp);
  }
  const topList = [...top.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
  const maxQty = topList[0]?.[1].qty ?? 1;
  const statusRows = Object.entries(STATUS_LABELS).map(([k, label]) => ({ k, label, n: byStatus.find((b) => b.status === k)?._count ?? 0 }));
  const maxStatus = Math.max(1, ...statusRows.map((s) => s.n));

  const fmtD = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="لوحة المؤشرات" />
      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4 text-sm">
        <div><label className="label">من</label><input type="date" name="from" defaultValue={sp.from ?? fmtD(f)} className="input" /></div>
        <div><label className="label">إلى</label><input type="date" name="to" defaultValue={sp.to ?? fmtD(t)} className="input" /></div>
        <div>
          <label className="label">القسم</label>
          <select name="category" defaultValue={sp.category ?? ""} className="input">
            <option value="">كل الأقسام</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {showCosts && (
          <div>
            <label className="label">المورد</label>
            <select name="supplier" defaultValue={sp.supplier ?? ""} className="input">
              <option value="">كل الموردين</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <button className="btn-primary">تطبيق</button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="إجمالي الطلبات" value={allCount} href="/admin/orders" />
        <Stat label="طلبات جديدة" value={count(["NEW", "CONFIRMING"])} href="/admin/orders?status=NEW" tone="text-amber-600" />
        <Stat label="قيد الشراء" value={count(["PURCHASING", "PURCHASED"])} href="/admin/orders?status=PURCHASING" />
        <Stat label="قيد الشحن الدولي" value={count(["INTL_SHIPPING"])} href="/admin/orders?status=INTL_SHIPPING" />
        <Stat label="وصلت إلى ليبيا" value={count(["ARRIVED_LIBYA"])} href="/admin/orders?status=ARRIVED_LIBYA" />
        <Stat label="لدى النورس" value={count(["HANDED_TO_NAWRAS", "IN_DISTRIBUTION", "OUT_FOR_DELIVERY"])} href="/admin/orders?status=HANDED_TO_NAWRAS" />
        <Stat label="تم تسليمها" value={count(["DELIVERED"])} href="/admin/orders?status=DELIVERED" tone="text-emerald-600" />
        <Stat label="متعثرة" value={count(["DELIVERY_FAILED"])} href="/admin/orders?status=DELIVERY_FAILED" tone="text-red-600" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="إجمالي المبيعات (بدون الملغاة)" value={lyd(revenue)} />
        <Stat label="رسوم التوصيل المحصّلة من العملاء" value={lyd(totals._sum.deliveryFee)} />
        {showCosts && <Stat label="الأرباح المتوقعة" value={lyd(revenue - expectedCost)} />}
        {showCosts && <Stat label="الأرباح الفعلية (الطلبات المسلّمة)" value={lyd(deliveredRevenue - deliveredCost)} />}
        {showCosts && <Stat label="تكلفة المشتريات (أوامر الشراء)" value={lyd(purchaseCost)} href="/admin/purchase-orders" />}
        {showCosts && <Stat label="تكاليف الشحن والجمارك" value={lyd(shippingCost)} href="/admin/shipments" />}
        {nawrasFees && <Stat label="أجور التوصيل للنورس" value={lyd(nawrasFees._sum.fee ?? 0)} href="/admin/delivery/list?status=all" />}
        {pendingCod && <Stat label="محصّل لدى النورس بانتظار التسوية" value={lyd(pendingCod._sum.collected ?? 0)} href="/admin/delivery/settlements" tone="text-amber-700" />}
      </div>
      {showCosts && (
        <p className="mt-2 text-xs text-gray-500">
          الأرباح تُحسب من التكلفة الفعلية للبند (سعر الشراء × سعر الصرف + نصيبه من الشحن والجمارك) عند توفرها، وإلا من التكلفة التقديرية وقت الطلب.
          {missingCost > 0 && ` ${missingCost} بنداً بلا أي تكلفة مسجلة.`}
          {deliveredMissingActual > 0 && ` ${deliveredMissingActual} بنداً مسلّماً بلا تكلفة فعلية بعد.`}
          {posMissingRate > 0 && ` ${posMissingRate} أمر شراء بلا سعر صرف لم يُحتسب.`}
          {" "}أجور النورس تُقابلها رسوم التوصيل المحصّلة من العملاء، وتظهر منفصلة. المحصّل لدى النورس يصبح دفعة على الطلب عند تسجيل التسوية.
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-bold">الطلبات حسب الحالة</h2>
          <ul className="space-y-1.5 text-sm">
            {statusRows.map((s) => (
              <li key={s.k} className="grid grid-cols-[140px_1fr_40px] items-center gap-2">
                <span className="text-gray-600">{s.label}</span>
                <span className="h-3 rounded bg-gray-100"><span className="block h-3 rounded bg-brand-600" style={{ width: `${(s.n / maxStatus) * 100}%` }} /></span>
                <span className="text-left font-medium">{s.n}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-bold">المنتجات الأكثر مبيعاً</h2>
          {topList.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد مبيعات في هذه الفترة.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {topList.map(([id, p]) => (
                <li key={id} className="grid grid-cols-[1fr_120px_40px] items-center gap-2">
                  <Link href={`/admin/products/${id}`} className="truncate hover:text-brand-700">{p.name}</Link>
                  <span className="h-3 rounded bg-gray-100"><span className="block h-3 rounded bg-brand-600" style={{ width: `${(p.qty / maxQty) * 100}%` }} /></span>
                  <span className="text-left font-medium">{p.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card overflow-hidden">
          <h2 className="p-4 pb-2 font-bold">أحدث الطلبات</h2>
          <table className="table">
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-700" dir="ltr">{o.number}</Link></td>
                  <td>{o.shipName}</td>
                  <td>{lyd(o.total)}</td>
                  <td><span className={`badge ${statusTone(o.status)}`}>{STATUS_LABELS[o.status]}</span></td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td className="text-gray-500">لا توجد طلبات في هذه الفترة.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="card overflow-hidden">
          <h2 className="p-4 pb-2 font-bold">مخزون محلي منخفض (٢ أو أقل)</h2>
          <table className="table">
            <tbody>
              {lowStock.map((v) => (
                <tr key={v.id}>
                  <td><Link href={`/admin/products/${v.product.id}`} className="hover:text-brand-700">{v.product.name}{v.name ? ` (${v.name})` : ""}</Link></td>
                  <td className={v.stockQty === 0 ? "text-red-600" : ""}>{v.stockQty}</td>
                </tr>
              ))}
              {lowStock.length === 0 && <tr><td className="text-gray-500">لا يوجد.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
