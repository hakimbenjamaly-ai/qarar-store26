import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { STATUS_LABELS } from "./order-status";
import { DELIVERY_STATUS_LABELS } from "./delivery-status";
import { calcPrice } from "./pricing";
import { latestRates, getSettings } from "./settings";

// كل التقارير تُبنى من البيانات الفعلية المسجلة فقط، وبنفس البنية للعرض والتصدير

export type ColType = "text" | "money" | "int" | "pct" | "date";
export type Col = { key: string; label: string; type?: ColType };
export type Row = Record<string, string | number | Date | null>;
export type Section = { title: string; columns: Col[]; rows: Row[]; totals?: Row; note?: string };
export type Report = { key: string; title: string; summary: { label: string; value: number | string; type?: ColType; tone?: string }[]; sections: Section[]; needsCosts?: boolean };

export const REPORTS: { key: string; title: string; costs?: boolean }[] = [
  { key: "sales", title: "المبيعات" },
  { key: "profit", title: "الأرباح وصافي الربح", costs: true },
  { key: "purchasing", title: "المشتريات والشحن الدولي", costs: true },
  { key: "delivery", title: "التوصيل والتسويات" },
  { key: "receivables", title: "الذمم والمبالغ المستحقة" },
  { key: "cash", title: "الدفعات والمصروفات" },
  { key: "inventory", title: "المخزون", costs: true },
  { key: "customers", title: "العملاء" },
];

export function parseRange(from?: string, to?: string) {
  // التواريخ بتوقيت ليبيا (UTC+2)
  const f = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(from + "T00:00:00+02:00") : new Date(Date.now() - 30 * 864e5);
  const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(to + "T23:59:59.999+02:00") : new Date();
  return { f, t };
}

const day = (d: Date) => new Date(d.getTime() + 2 * 3600e3).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const paidOf = (ps: { kind: string; amount: Prisma.Decimal }[]) => ps.reduce((s, p) => s + (p.kind === "REFUND" ? -1 : 1) * Number(p.amount), 0);
const sum = <T,>(xs: T[], f: (x: T) => number) => r2(xs.reduce((s, x) => s + f(x), 0));

function group<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const a = m.get(k);
    if (a) a.push(x);
    else m.set(k, [x]);
  }
  return m;
}

/** تاريخ تسليم الطلب: أول انتقال للطلب إلى «تم التسليم» */
async function deliveredOrdersIn(f: Date, t: Date) {
  const h = await db.orderStatusHistory.findMany({ where: { orderItemId: null, toStatus: "DELIVERED", createdAt: { gte: f, lte: t } }, select: { orderId: true, createdAt: true } });
  return new Map(h.map((x) => [x.orderId, x.createdAt]));
}

async function sales(f: Date, t: Date): Promise<Report> {
  const orders = await db.order.findMany({
    where: { createdAt: { gte: f, lte: t }, status: { not: "CANCELLED" } },
    include: { items: { include: { variant: { include: { product: { include: { category: { include: { parent: true } } } } } } } } },
  });
  const live = (o: (typeof orders)[number]) => o.items.filter((i) => i.status !== "CANCELLED" && i.status !== "RETURNED");
  const itemsRevenue = (o: (typeof orders)[number]) => live(o).reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const byDay = [...group(orders, (o) => day(o.createdAt)).entries()].sort().map(([d, os]) => ({
    date: d,
    orders: os.length,
    items: sum(os, (o) => live(o).reduce((s, i) => s + i.quantity, 0)),
    revenue: sum(os, itemsRevenue),
    delivery: sum(os, (o) => Number(o.deliveryFee)),
    discount: sum(os, (o) => Number(o.discount)),
  }));
  const allItems = orders.flatMap(live);
  const catName = (i: (typeof allItems)[number]) => {
    const c = i.variant.product.category;
    return c.parent ? c.parent.name : c.name;
  };
  const byCat = [...group(allItems, catName).entries()].map(([name, xs]) => ({ name, qty: sum(xs, (i) => i.quantity), revenue: sum(xs, (i) => Number(i.unitPrice) * i.quantity) })).sort((a, b) => b.revenue - a.revenue);
  const byCity = [...group(orders, (o) => o.shipCity).entries()].map(([name, os]) => ({ name, orders: os.length, revenue: sum(os, (o) => itemsRevenue(o) + Number(o.deliveryFee) - Number(o.discount)) })).sort((a, b) => b.revenue - a.revenue);
  const byProduct = [...group(allItems, (i) => i.variant.productId).values()].map((xs) => ({ name: xs[0].productName, sku: xs[0].variant.product.sku, qty: sum(xs, (i) => i.quantity), revenue: sum(xs, (i) => Number(i.unitPrice) * i.quantity) })).sort((a, b) => b.qty - a.qty).slice(0, 50);
  const bySource = [...group(allItems, (i) => (i.sourcing === "LOCAL_STOCK" ? "مخزون محلي" : "استيراد عند الطلب")).entries()].map(([name, xs]) => ({ name, qty: sum(xs, (i) => i.quantity), revenue: sum(xs, (i) => Number(i.unitPrice) * i.quantity) }));
  const revenue = sum(orders, itemsRevenue);
  const cancelled = await db.order.count({ where: { createdAt: { gte: f, lte: t }, status: "CANCELLED" } });
  return {
    key: "sales",
    title: "تقرير المبيعات",
    summary: [
      { label: "عدد الطلبات", value: orders.length, type: "int" },
      { label: "قيمة المنتجات المباعة", value: revenue, type: "money" },
      { label: "متوسط قيمة الطلب", value: orders.length ? r2(revenue / orders.length) : 0, type: "money" },
      { label: "رسوم التوصيل من العملاء", value: sum(orders, (o) => Number(o.deliveryFee)), type: "money" },
      { label: "طلبات ملغاة", value: cancelled, type: "int" },
    ],
    sections: [
      { title: "حسب اليوم", columns: [{ key: "date", label: "التاريخ" }, { key: "orders", label: "الطلبات", type: "int" }, { key: "items", label: "القطع", type: "int" }, { key: "revenue", label: "المنتجات", type: "money" }, { key: "delivery", label: "التوصيل", type: "money" }, { key: "discount", label: "الخصم", type: "money" }], rows: byDay, totals: { date: "الإجمالي", orders: orders.length, items: sum(byDay, (x) => x.items), revenue, delivery: sum(byDay, (x) => x.delivery), discount: sum(byDay, (x) => x.discount) } },
      { title: "حسب القسم", columns: [{ key: "name", label: "القسم" }, { key: "qty", label: "القطع", type: "int" }, { key: "revenue", label: "المبيعات", type: "money" }], rows: byCat },
      { title: "حسب المدينة", columns: [{ key: "name", label: "المدينة" }, { key: "orders", label: "الطلبات", type: "int" }, { key: "revenue", label: "الإجمالي", type: "money" }], rows: byCity },
      { title: "حسب نوع التوفير", columns: [{ key: "name", label: "النوع" }, { key: "qty", label: "القطع", type: "int" }, { key: "revenue", label: "المبيعات", type: "money" }], rows: bySource },
      { title: "المنتجات الأكثر مبيعاً", columns: [{ key: "name", label: "المنتج" }, { key: "sku", label: "SKU" }, { key: "qty", label: "القطع", type: "int" }, { key: "revenue", label: "المبيعات", type: "money" }], rows: byProduct },
    ],
  };
}

async function profit(f: Date, t: Date): Promise<Report> {
  const delivered = await deliveredOrdersIn(f, t);
  const orders = await db.order.findMany({ where: { id: { in: [...delivered.keys()] } }, include: { items: { where: { status: "DELIVERED" } }, deliveries: { where: { status: "DELIVERED" } } } });
  let missing = 0;
  const rows = orders.map((o) => {
    const revenue = o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const cost = o.items.reduce((s, i) => {
      const u = i.actualUnitCostLyd ?? i.estUnitCostLyd;
      if (u === null) missing++;
      return s + (u === null ? 0 : Number(u) * i.quantity);
    }, 0);
    const fees = o.deliveries.reduce((s, d) => s + Number(d.fee), 0);
    const gross = revenue - Number(o.discount) - cost;
    return { date: day(delivered.get(o.id)!), number: o.number, revenue: r2(revenue), discount: Number(o.discount), cost: r2(cost), deliveryIn: Number(o.deliveryFee), deliveryOut: r2(fees), profit: r2(gross + Number(o.deliveryFee) - fees), actual: o.items.every((i) => i.actualUnitCostLyd !== null || i.sourcing === "LOCAL_STOCK") ? "فعلية" : "تقديرية جزئياً" };
  }).sort((a, b) => a.date.localeCompare(b.date));
  // المرتجعات في الفترة: أجور التوصيل المدفوعة عليها خسارة
  const returnedFees = await db.delivery.aggregate({ where: { status: "RETURNED", updatedAt: { gte: f, lte: t } }, _sum: { fee: true } });
  const expenses = await db.expense.findMany({ where: { date: { gte: f, lte: t } } });
  const byCat = [...group(expenses, (e) => e.category).entries()].map(([name, xs]) => ({ name, count: xs.length, amount: sum(xs, (e) => Number(e.amount)) })).sort((a, b) => b.amount - a.amount);
  const gross = sum(rows, (r) => r.profit);
  const retFees = Number(returnedFees._sum.fee ?? 0);
  const exp = sum(expenses, (e) => Number(e.amount));
  return {
    key: "profit",
    title: "تقرير الأرباح وصافي الربح",
    needsCosts: true,
    summary: [
      { label: "طلبات مسلّمة في الفترة", value: rows.length, type: "int" },
      { label: "إيراد المنتجات المسلّمة", value: sum(rows, (r) => r.revenue), type: "money" },
      { label: "تكلفة البضاعة", value: sum(rows, (r) => r.cost), type: "money" },
      { label: "الربح من الطلبات (بعد التوصيل)", value: gross, type: "money" },
      { label: "أجور توصيل المرتجعات", value: retFees, type: "money" },
      { label: "المصروفات التشغيلية", value: exp, type: "money" },
      { label: "صافي الربح", value: r2(gross - retFees - exp), type: "money", tone: gross - retFees - exp < 0 ? "text-red-700" : "text-emerald-700" },
    ],
    sections: [
      {
        title: "الطلبات المسلّمة",
        note: missing ? `${missing} بنداً بلا تكلفة مسجلة احتُسبت تكلفتها صفراً.` : "التكلفة الفعلية من أوامر الشراء والشحن عند توفرها، وإلا التقديرية وقت الطلب.",
        columns: [{ key: "date", label: "تاريخ التسليم" }, { key: "number", label: "الطلب" }, { key: "revenue", label: "المنتجات", type: "money" }, { key: "discount", label: "الخصم", type: "money" }, { key: "cost", label: "التكلفة", type: "money" }, { key: "deliveryIn", label: "توصيل من العميل", type: "money" }, { key: "deliveryOut", label: "أجرة النورس", type: "money" }, { key: "profit", label: "الربح", type: "money" }, { key: "actual", label: "التكلفة" }],
        rows,
        totals: { date: "الإجمالي", revenue: sum(rows, (r) => r.revenue), discount: sum(rows, (r) => r.discount), cost: sum(rows, (r) => r.cost), deliveryIn: sum(rows, (r) => r.deliveryIn), deliveryOut: sum(rows, (r) => r.deliveryOut), profit: gross },
      },
      { title: "المصروفات حسب البند", columns: [{ key: "name", label: "البند" }, { key: "count", label: "العدد", type: "int" }, { key: "amount", label: "المبلغ", type: "money" }], rows: byCat, totals: { name: "الإجمالي", amount: exp } },
    ],
  };
}

async function purchasing(f: Date, t: Date): Promise<Report> {
  const pos = await db.purchaseOrder.findMany({ where: { status: { notIn: ["DRAFT", "CANCELLED"] }, orderedAt: { gte: f, lte: t } }, include: { supplier: true, items: true } });
  const lyd = (p: (typeof pos)[number]) => (p.currency === "LYD" ? Number(p.total) : p.exchangeRate ? Number(p.total) * Number(p.exchangeRate) : null);
  const bySup = [...group(pos, (p) => p.supplier.name).entries()].map(([name, ps]) => ({ name, count: ps.length, lines: sum(ps, (p) => p.items.length), qty: sum(ps, (p) => p.items.reduce((s, i) => s + i.quantity, 0)), total: sum(ps, (p) => lyd(p) ?? 0), missing: ps.filter((p) => lyd(p) === null).length }));
  const ships = await db.shipment.findMany({ where: { status: { not: "CANCELLED" }, createdAt: { gte: f, lte: t } }, include: { carrier: true, items: true } });
  const shipLyd = (s: (typeof ships)[number]) => (s.costCurrency === "LYD" ? Number(s.cost) : s.exchangeRate ? Number(s.cost) * Number(s.exchangeRate) : 0);
  const byCarrier = [...group(ships, (s) => s.carrier?.name ?? "بدون شركة").entries()].map(([name, ss]) => ({ name, count: ss.length, weight: sum(ss, (s) => Number(s.weightKg ?? 0)), shipping: sum(ss, shipLyd), customs: sum(ss, (s) => Number(s.customsFeesLyd)), avgDays: (() => { const done = ss.filter((s) => s.shippedAt && s.arrivedAt); return done.length ? r2(done.reduce((a, s) => a + (s.arrivedAt!.getTime() - s.shippedAt!.getTime()) / 864e5, 0) / done.length) : null; })() }));
  return {
    key: "purchasing",
    title: "تقرير المشتريات والشحن الدولي",
    needsCosts: true,
    summary: [
      { label: "أوامر شراء مؤكدة", value: pos.length, type: "int" },
      { label: "قيمة المشتريات (د.ل)", value: sum(pos, (p) => lyd(p) ?? 0), type: "money" },
      { label: "شحنات", value: ships.length, type: "int" },
      { label: "الشحن", value: sum(ships, shipLyd), type: "money" },
      { label: "الجمارك والتخليص", value: sum(ships, (s) => Number(s.customsFeesLyd)), type: "money" },
    ],
    sections: [
      { title: "حسب المورد", note: bySup.some((x) => x.missing) ? "أوامر بلا سعر صرف لم تُحتسب قيمتها." : undefined, columns: [{ key: "name", label: "المورد" }, { key: "count", label: "الأوامر", type: "int" }, { key: "lines", label: "البنود", type: "int" }, { key: "qty", label: "القطع", type: "int" }, { key: "total", label: "القيمة د.ل", type: "money" }, { key: "missing", label: "بلا سعر صرف", type: "int" }], rows: bySup },
      { title: "حسب شركة الشحن", columns: [{ key: "name", label: "الشركة" }, { key: "count", label: "الشحنات", type: "int" }, { key: "weight", label: "الوزن كغ", type: "int" }, { key: "shipping", label: "الشحن", type: "money" }, { key: "customs", label: "الجمارك", type: "money" }, { key: "avgDays", label: "متوسط أيام الوصول", type: "int" }], rows: byCarrier },
    ],
  };
}

async function delivery(f: Date, t: Date): Promise<Report> {
  const ds = await db.delivery.findMany({ where: { createdAt: { gte: f, lte: t } }, include: { partner: true, order: { select: { shipCity: true } } } });
  const byPartner = [...group(ds, (d) => d.partner.name).entries()].map(([name, xs]) => {
    const done = xs.filter((d) => d.status === "DELIVERED").length;
    const closed = xs.filter((d) => ["DELIVERED", "RETURNED"].includes(d.status)).length;
    return { name, total: xs.length, delivered: done, failed: xs.filter((d) => d.status === "FAILED").length, returned: xs.filter((d) => d.status === "RETURNED").length, active: xs.filter((d) => ["READY", "HANDED_OVER", "IN_DISTRIBUTION", "OUT_FOR_DELIVERY"].includes(d.status)).length, rate: closed ? r2((done / closed) * 100) : null, collected: sum(xs, (d) => Number(d.collected ?? 0)), fees: sum(xs.filter((d) => ["DELIVERED", "RETURNED"].includes(d.status)), (d) => Number(d.fee)) };
  });
  const byCity = [...group(ds, (d) => d.order.shipCity).entries()].map(([name, xs]) => ({ name, total: xs.length, delivered: xs.filter((d) => d.status === "DELIVERED").length, failed: xs.filter((d) => d.status === "FAILED" || d.status === "RETURNED").length }));
  const events = await db.deliveryEvent.findMany({ where: { status: "FAILED", createdAt: { gte: f, lte: t } }, select: { note: true } });
  const reasons = [...group(events, (e) => e.note.trim() || "بدون سبب").entries()].map(([reason, xs]) => ({ reason, count: xs.length })).sort((a, b) => b.count - a.count);
  const settlements = await db.settlement.findMany({ where: { createdAt: { gte: f, lte: t } }, include: { partner: true } });
  const pending = await db.delivery.aggregate({ where: { status: "DELIVERED", settlementId: null }, _sum: { collected: true }, _count: true });
  const statusRows = Object.entries(DELIVERY_STATUS_LABELS).map(([k, label]) => ({ label, count: ds.filter((d) => d.status === k).length })).filter((x) => x.count);
  return {
    key: "delivery",
    title: "تقرير التوصيل والتسويات",
    summary: [
      { label: "طرود جُهّزت في الفترة", value: ds.length, type: "int" },
      { label: "سُلّمت", value: ds.filter((d) => d.status === "DELIVERED").length, type: "int" },
      { label: "تعذر/مرتجع", value: ds.filter((d) => d.status === "FAILED" || d.status === "RETURNED").length, type: "int" },
      { label: "المحصّل", value: sum(ds, (d) => Number(d.collected ?? 0)), type: "money" },
      { label: "لدى النورس بانتظار التسوية (الآن)", value: Number(pending._sum.collected ?? 0), type: "money", tone: "text-amber-700" },
    ],
    sections: [
      { title: "حسب الشركة", columns: [{ key: "name", label: "الشركة" }, { key: "total", label: "الطرود", type: "int" }, { key: "delivered", label: "سُلّمت", type: "int" }, { key: "failed", label: "متعذرة", type: "int" }, { key: "returned", label: "مرتجعة", type: "int" }, { key: "active", label: "جارية", type: "int" }, { key: "rate", label: "نسبة النجاح", type: "pct" }, { key: "collected", label: "المحصّل", type: "money" }, { key: "fees", label: "الأجور", type: "money" }], rows: byPartner },
      { title: "حسب الحالة", columns: [{ key: "label", label: "الحالة" }, { key: "count", label: "العدد", type: "int" }], rows: statusRows },
      { title: "حسب المدينة", columns: [{ key: "name", label: "المدينة" }, { key: "total", label: "الطرود", type: "int" }, { key: "delivered", label: "سُلّمت", type: "int" }, { key: "failed", label: "تعذر/مرتجع", type: "int" }], rows: byCity },
      { title: "أسباب تعذر التسليم", columns: [{ key: "reason", label: "السبب" }, { key: "count", label: "المرات", type: "int" }], rows: reasons },
      { title: "التسويات المسجلة", columns: [{ key: "number", label: "الرقم" }, { key: "partner", label: "الشركة" }, { key: "date", label: "التاريخ", type: "date" }, { key: "collected", label: "المحصّل", type: "money" }, { key: "fees", label: "الأجور", type: "money" }, { key: "net", label: "الصافي المستلم", type: "money" }, { key: "diff", label: "الفرق", type: "money" }], rows: settlements.map((s) => ({ number: s.number, partner: s.partner.name, date: s.receivedAt ?? s.createdAt, collected: Number(s.collected), fees: Number(s.feesDeducted), net: Number(s.netReceived), diff: r2(Number(s.netReceived) - (Number(s.collected) - Number(s.feesDeducted))) })) },
    ],
  };
}

async function receivables(): Promise<Report> {
  const orders = await db.order.findMany({ where: { status: { notIn: ["CANCELLED", "RETURNED"] } }, include: { payments: true, deliveries: { where: { status: "DELIVERED", settlementId: null } } }, orderBy: { createdAt: "asc" } });
  const now = Date.now();
  const rows = orders
    .map((o) => {
      const paid = paidOf(o.payments);
      const withNawras = o.deliveries.reduce((s, d) => s + Number(d.collected ?? 0), 0);
      return { number: o.number, date: o.createdAt, customer: o.shipName, phone: o.shipPhone, status: STATUS_LABELS[o.status], total: Number(o.total), paid: r2(paid), withNawras: r2(withNawras), due: r2(Number(o.total) - paid - withNawras), deposit: Number(o.depositRequired) > paid ? r2(Number(o.depositRequired) - paid) : 0, age: Math.floor((now - o.createdAt.getTime()) / 864e5) };
    })
    .filter((r) => r.due > 0.009 || r.withNawras > 0);
  return {
    key: "receivables",
    title: "تقرير الذمم والمبالغ المستحقة",
    summary: [
      { label: "طلبات عليها مبالغ", value: rows.filter((r) => r.due > 0.009).length, type: "int" },
      { label: "مستحق على العملاء", value: sum(rows, (r) => Math.max(0, r.due)), type: "money", tone: "text-amber-700" },
      { label: "محصّل لدى النورس", value: sum(rows, (r) => r.withNawras), type: "money" },
      { label: "عربون غير مدفوع", value: sum(rows, (r) => r.deposit), type: "money" },
    ],
    sections: [
      {
        title: "الطلبات (لا يتأثر بالفترة)",
        columns: [{ key: "number", label: "الطلب" }, { key: "date", label: "التاريخ", type: "date" }, { key: "customer", label: "العميل" }, { key: "phone", label: "الهاتف" }, { key: "status", label: "الحالة" }, { key: "total", label: "الإجمالي", type: "money" }, { key: "paid", label: "المدفوع", type: "money" }, { key: "withNawras", label: "لدى النورس", type: "money" }, { key: "due", label: "المتبقي", type: "money" }, { key: "deposit", label: "عربون ناقص", type: "money" }, { key: "age", label: "العمر بالأيام", type: "int" }],
        rows,
        totals: { number: "الإجمالي", total: sum(rows, (r) => r.total), paid: sum(rows, (r) => r.paid), withNawras: sum(rows, (r) => r.withNawras), due: sum(rows, (r) => r.due), deposit: sum(rows, (r) => r.deposit) },
      },
    ],
  };
}

async function cash(f: Date, t: Date): Promise<Report> {
  const pays = await db.payment.findMany({ where: { receivedAt: { gte: f, lte: t } }, include: { method: true } });
  const KIND = { DEPOSIT: "عربون", PAYMENT: "دفعة", REFUND: "استرداد" } as Record<string, string>;
  const byMethod = [...group(pays, (p) => `${p.method?.name ?? "غير محددة"}|${KIND[p.kind]}`).entries()].map(([k, xs]) => ({ method: k.split("|")[0], kind: k.split("|")[1], count: xs.length, amount: sum(xs, (p) => Number(p.amount)) }));
  const inflow = sum(pays.filter((p) => p.kind !== "REFUND"), (p) => Number(p.amount));
  const refunds = sum(pays.filter((p) => p.kind === "REFUND"), (p) => Number(p.amount));
  const expenses = await db.expense.findMany({ where: { date: { gte: f, lte: t } }, orderBy: { date: "asc" } });
  const exp = sum(expenses, (e) => Number(e.amount));
  return {
    key: "cash",
    title: "تقرير الدفعات والمصروفات",
    summary: [
      { label: "المقبوضات", value: inflow, type: "money" },
      { label: "الاستردادات", value: refunds, type: "money" },
      { label: "المصروفات التشغيلية", value: exp, type: "money" },
      { label: "الصافي النقدي (بدون مدفوعات الموردين)", value: r2(inflow - refunds - exp), type: "money" },
    ],
    sections: [
      { title: "المقبوضات حسب الطريقة والنوع", columns: [{ key: "method", label: "الطريقة" }, { key: "kind", label: "النوع" }, { key: "count", label: "العدد", type: "int" }, { key: "amount", label: "المبلغ", type: "money" }], rows: byMethod },
      { title: "المصروفات", columns: [{ key: "date", label: "التاريخ", type: "date" }, { key: "category", label: "البند" }, { key: "amount", label: "المبلغ", type: "money" }, { key: "note", label: "ملاحظة" }], rows: expenses.map((e) => ({ date: e.date, category: e.category, amount: Number(e.amount), note: e.note })), totals: { date: "الإجمالي", amount: exp } },
    ],
  };
}

async function inventory(f: Date, t: Date): Promise<Report> {
  const [vs, rates, s] = await Promise.all([
    db.productVariant.findMany({ where: { product: { sourcingType: "LOCAL_STOCK" } }, include: { product: true, cost: true }, orderBy: { stockQty: "asc" } }),
    latestRates(),
    getSettings(),
  ]);
  const threshold = s.lowStockThreshold;
  const unitCost = (v: (typeof vs)[number]) => {
    if (!v.cost) return null;
    const pr = rates[v.cost.purchaseCurrency];
    const sr = rates[v.cost.shippingCurrency];
    if (pr === undefined || sr === undefined) return null;
    return calcPrice({ purchasePrice: Number(v.cost.purchasePrice), purchaseRate: pr, shippingCost: Number(v.cost.shippingCost), shippingRate: sr, otherFeesLyd: Number(v.cost.otherFeesLyd), localDeliveryLyd: 0, marginType: "FIXED", marginValue: 0 }).landedCost;
  };
  const rows = vs.map((v) => {
    const c = unitCost(v);
    return { product: v.product.name, variant: v.name, sku: v.sku, qty: v.stockQty, price: Number(v.price), unitCost: c, value: c === null ? null : r2(c * v.stockQty), saleValue: r2(Number(v.price) * v.stockQty), low: v.active && v.stockQty <= threshold ? "منخفض" : "" };
  });
  const moves = await db.inventoryMovement.findMany({ where: { createdAt: { gte: f, lte: t } }, include: { variant: { include: { product: true } } } });
  const MT = { IN: "وارد", OUT: "صادر", RESERVE: "حجز لطلب", RELEASE: "فك حجز", RETURN: "مرتجع", ADJUST: "تسوية جرد" } as Record<string, string>;
  const byType = [...group(moves, (m) => m.type).entries()].map(([k, xs]) => ({ type: MT[k] ?? k, count: xs.length, qty: sum(xs, (m) => m.quantity) }));
  return {
    key: "inventory",
    title: "تقرير المخزون المحلي",
    needsCosts: true,
    summary: [
      { label: "أصناف", value: rows.length, type: "int" },
      { label: "قطع في المخزون", value: sum(rows, (r) => r.qty), type: "int" },
      { label: "قيمة المخزون بالتكلفة", value: sum(rows, (r) => r.value ?? 0), type: "money" },
      { label: "قيمة المخزون بسعر البيع", value: sum(rows, (r) => r.saleValue), type: "money" },
      { label: `أصناف منخفضة (≤ ${threshold})`, value: rows.filter((r) => r.low).length, type: "int", tone: "text-red-700" },
    ],
    sections: [
      { title: "الأرصدة الحالية", note: rows.some((r) => r.unitCost === null) ? "أصناف بلا تكلفة أو سعر صرف لم تُحتسب قيمتها بالتكلفة." : undefined, columns: [{ key: "product", label: "المنتج" }, { key: "variant", label: "الخيار" }, { key: "sku", label: "SKU" }, { key: "qty", label: "الكمية", type: "int" }, { key: "unitCost", label: "تكلفة الوحدة", type: "money" }, { key: "value", label: "القيمة بالتكلفة", type: "money" }, { key: "price", label: "سعر البيع", type: "money" }, { key: "saleValue", label: "القيمة بالبيع", type: "money" }, { key: "low", label: "تنبيه" }], rows },
      { title: "حركات المخزون في الفترة", columns: [{ key: "type", label: "النوع" }, { key: "count", label: "الحركات", type: "int" }, { key: "qty", label: "صافي الكمية", type: "int" }], rows: byType },
    ],
  };
}

async function customers(f: Date, t: Date): Promise<Report> {
  const orders = await db.order.findMany({ where: { createdAt: { gte: f, lte: t }, status: { not: "CANCELLED" } }, include: { customer: true } });
  const byCustomer = [...group(orders, (o) => o.customerId).values()].map((os) => ({ name: os[0].customer.fullName, phone: os[0].customer.phone, city: os[os.length - 1].shipCity, orders: os.length, total: sum(os, (o) => Number(o.total)), last: os.reduce((m, o) => (o.createdAt > m ? o.createdAt : m), os[0].createdAt) })).sort((a, b) => b.total - a.total);
  const newCustomers = await db.customer.count({ where: { createdAt: { gte: f, lte: t } } });
  const repeat = byCustomer.filter((c) => c.orders > 1).length;
  const lang = orders.filter((o) => o.locale === "en").length;
  return {
    key: "customers",
    title: "تقرير العملاء",
    summary: [
      { label: "عملاء طلبوا في الفترة", value: byCustomer.length, type: "int" },
      { label: "عملاء جدد", value: newCustomers, type: "int" },
      { label: "تكرار الطلب", value: byCustomer.length ? r2((repeat / byCustomer.length) * 100) : 0, type: "pct" },
      { label: "طلبات بالواجهة الإنجليزية", value: lang, type: "int" },
    ],
    sections: [{ title: "العملاء حسب قيمة الطلبات", columns: [{ key: "name", label: "العميل" }, { key: "phone", label: "الهاتف" }, { key: "city", label: "المدينة" }, { key: "orders", label: "الطلبات", type: "int" }, { key: "total", label: "الإجمالي", type: "money" }, { key: "last", label: "آخر طلب", type: "date" }], rows: byCustomer.slice(0, 200) }],
  };
}

export async function buildReport(key: string, f: Date, t: Date): Promise<Report | null> {
  switch (key) {
    case "sales":
      return sales(f, t);
    case "profit":
      return profit(f, t);
    case "purchasing":
      return purchasing(f, t);
    case "delivery":
      return delivery(f, t);
    case "receivables":
      return receivables();
    case "cash":
      return cash(f, t);
    case "inventory":
      return inventory(f, t);
    case "customers":
      return customers(f, t);
    default:
      return null;
  }
}
