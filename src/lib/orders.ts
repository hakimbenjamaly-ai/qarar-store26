import "server-only";
import { Prisma, type OrderStatus } from "@prisma/client";
import { db } from "./db";
import { nextNumber } from "./numbering";
import { allowedNext, deriveOrderStatus, PROGRESS, STATUS_LABELS } from "./order-status";
import { calcPrice } from "./pricing";
import { getSettings, latestRates } from "./settings";
import { audit } from "./audit";

export class OrderError extends Error {}

export type CheckoutInput = {
  fullName: string;
  phone: string; // موحّد مسبقاً
  whatsapp?: string | null;
  cityId: string;
  region: string;
  address: string;
  landmark: string;
  note: string;
  paymentMethodId: string;
  items: { variantId: string; quantity: number }[];
};

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

/** ينشئ طلب العميل. الأسعار والتوفر تُقرأ من قاعدة البيانات، لا من المتصفح. */
export async function placeOrder(input: CheckoutInput) {
  const merged = new Map<string, number>();
  for (const it of input.items) {
    const q = Math.floor(it.quantity);
    if (q < 1 || q > 99) throw new OrderError("كمية غير صحيحة");
    merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + q);
  }
  if (merged.size === 0) throw new OrderError("السلة فارغة");

  const settings = await getSettings();
  const rates = await latestRates();

  return db.$transaction(async (tx) => {
    const city = await tx.city.findFirst({ where: { id: input.cityId, active: true } });
    if (!city) throw new OrderError("المدينة غير متاحة للتوصيل حالياً");
    const method = await tx.paymentMethod.findFirst({ where: { id: input.paymentMethodId, enabled: true } });
    if (!method) throw new OrderError("طريقة الدفع غير متاحة");

    const variants = await tx.productVariant.findMany({
      where: { id: { in: [...merged.keys()] }, active: true, product: { published: true } },
      include: { product: true, cost: true },
    });
    if (variants.length !== merged.size) throw new OrderError("بعض المنتجات في السلة لم تعد متاحة، يرجى مراجعة السلة");

    let subtotal = 0;
    let importSubtotal = 0;
    const lines = variants.map((v) => {
      const qty = merged.get(v.id)!;
      const price = Number(v.price);
      if (v.product.sourcingType === "LOCAL_STOCK" && v.stockQty < qty) {
        throw new OrderError(`الكمية المتاحة من «${v.product.name}» هي ${v.stockQty} فقط`);
      }
      subtotal += price * qty;
      if (v.product.sourcingType === "IMPORT_ON_ORDER") importSubtotal += price * qty;
      let estCost: number | null = null;
      if (v.cost) {
        const pr = rates[v.cost.purchaseCurrency];
        const sr = rates[v.cost.shippingCurrency];
        if (pr !== undefined && sr !== undefined) {
          estCost = calcPrice({
            purchasePrice: Number(v.cost.purchasePrice),
            purchaseRate: pr,
            shippingCost: Number(v.cost.shippingCost),
            shippingRate: sr,
            otherFeesLyd: Number(v.cost.otherFeesLyd),
            localDeliveryLyd: Number(v.cost.localDeliveryLyd),
            marginType: v.cost.marginType,
            marginValue: Number(v.cost.marginValue),
          }).landedCost;
        }
      }
      return { v, qty, price, estCost };
    });

    const deliveryFee = Number(city.deliveryFee);
    const total = subtotal + deliveryFee;
    const deposit = settings.importDepositPercent > 0 ? Math.ceil((importSubtotal * settings.importDepositPercent) / 100) : 0;

    const customer = await tx.customer.upsert({
      where: { phone: input.phone },
      create: { fullName: input.fullName, phone: input.phone, whatsapp: input.whatsapp || null },
      update: { whatsapp: input.whatsapp || undefined },
    });
    await tx.address.create({
      data: { customerId: customer.id, cityId: city.id, region: input.region, details: input.address, landmark: input.landmark },
    });

    const number = await nextNumber(tx, "ORD");
    const order = await tx.order.create({
      data: {
        number,
        customerId: customer.id,
        shipName: input.fullName,
        shipPhone: input.phone,
        shipWhatsapp: input.whatsapp || null,
        shipCity: city.name,
        shipRegion: input.region,
        shipAddress: input.address,
        shipLandmark: input.landmark,
        customerNote: input.note,
        subtotal: D(subtotal),
        deliveryFee: D(deliveryFee),
        total: D(total),
        paymentMethodId: method.id,
        depositRequired: D(deposit),
        items: {
          create: lines.map(({ v, qty, price, estCost }) => ({
            variantId: v.id,
            productName: v.product.name,
            variantName: v.name,
            sku: v.sku,
            quantity: qty,
            unitPrice: D(price),
            estUnitCostLyd: estCost === null ? null : D(estCost),
            sourcing: v.product.sourcingType,
          })),
        },
        history: { create: { toStatus: "NEW", note: "تم استلام الطلب من الموقع" } },
      },
    });

    // حجز المخزون المحلي
    for (const { v, qty } of lines) {
      if (v.product.sourcingType !== "LOCAL_STOCK") continue;
      const updated = await tx.productVariant.updateMany({ where: { id: v.id, stockQty: { gte: qty } }, data: { stockQty: { decrement: qty } } });
      if (updated.count !== 1) throw new OrderError(`نفدت الكمية المتاحة من «${v.product.name}»`);
      await tx.inventoryMovement.create({ data: { variantId: v.id, type: "RESERVE", quantity: -qty, reference: number } });
    }

    await tx.notification.create({
      data: { event: "order.new", title: `طلب جديد ${number}`, body: `${input.fullName} – ${city.name}`, link: `/admin/orders/${order.id}` },
    });

    return order;
  });
}

/**
 * يغيّر حالة بند أو كل بنود الطلب القابلة للانتقال، ويحدّث حالة الطلب المشتقة.
 * عند الإلغاء أو الإرجاع تعود الكميات المحلية للمخزون.
 */
export async function changeStatus(opts: { orderId: string; itemId?: string; to: OrderStatus; note: string; userId: string; restock?: boolean }) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: opts.orderId }, include: { items: true } });
    if (!order) throw new OrderError("الطلب غير موجود");
    const targets = opts.itemId ? order.items.filter((i) => i.id === opts.itemId) : order.items;
    if (targets.length === 0) throw new OrderError("البند غير موجود");

    const movable = targets.filter((i) => allowedNext(i.status, i.sourcing).includes(opts.to));
    if (movable.length === 0) throw new OrderError(`لا يمكن نقل ${opts.itemId ? "البند" : "الطلب"} إلى «${STATUS_LABELS[opts.to]}» من حالته الحالية`);

    for (const it of movable) {
      await tx.orderItem.update({ where: { id: it.id }, data: { status: opts.to } });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, orderItemId: it.id, fromStatus: it.status, toStatus: opts.to, note: opts.note, userId: opts.userId },
      });
      const returnsStock = it.sourcing === "LOCAL_STOCK" && (opts.to === "CANCELLED" || (opts.to === "RETURNED" && opts.restock));
      if (returnsStock) {
        await tx.productVariant.update({ where: { id: it.variantId }, data: { stockQty: { increment: it.quantity } } });
        await tx.inventoryMovement.create({
          data: { variantId: it.variantId, type: opts.to === "CANCELLED" ? "RELEASE" : "RETURN", quantity: it.quantity, reference: order.number, userId: opts.userId },
        });
      }
    }

    const after = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { status: true } });
    const derived = deriveOrderStatus(after.map((a) => a.status));
    if (derived !== order.status) {
      await tx.order.update({ where: { id: order.id }, data: { status: derived } });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: derived, note: opts.note, userId: opts.userId },
      });
    }
    await audit(opts.userId, "status_change", "Order", order.id, { status: order.status }, { status: derived, to: opts.to, items: movable.map((m) => m.id) }, tx);
    return { moved: movable.length, skipped: targets.length - movable.length, status: derived };
  });
}

/**
 * مزامنة حالات بنود الطلبات من أوامر الشراء والشحنات (داخل معاملة).
 * forward: ينقل البند للأمام فقط إذا كانت الحالة الجديدة أبعد في المسار، ولا يلمس البنود الملغاة/المرتجعة/المسلّمة/المتعثرة.
 * revert: يعيد البند إلى الحالة المحددة فقط إذا كان في إحدى الحالات المسموح الرجوع منها (مثل إلغاء أمر شراء).
 */
export async function syncItemsTx(
  tx: Prisma.TransactionClient,
  opts: { itemIds: string[]; to: OrderStatus; note: string; userId: string | null; revertFrom?: OrderStatus[] },
) {
  if (opts.itemIds.length === 0) return 0;
  const items = await tx.orderItem.findMany({ where: { id: { in: opts.itemIds } }, include: { order: true } });
  const target = PROGRESS.indexOf(opts.to);
  const movable = items.filter((i) => {
    if (opts.revertFrom) return opts.revertFrom.includes(i.status);
    const cur = PROGRESS.indexOf(i.status);
    return cur >= 0 && target > cur;
  });
  const orders = new Map<string, OrderStatus>();
  for (const it of movable) {
    await tx.orderItem.update({ where: { id: it.id }, data: { status: opts.to } });
    await tx.orderStatusHistory.create({ data: { orderId: it.orderId, orderItemId: it.id, fromStatus: it.status, toStatus: opts.to, note: opts.note, userId: opts.userId } });
    orders.set(it.orderId, it.order.status);
  }
  for (const [orderId, prev] of orders) {
    const after = await tx.orderItem.findMany({ where: { orderId }, select: { status: true } });
    const derived = deriveOrderStatus(after.map((a) => a.status));
    if (derived !== prev) {
      await tx.order.update({ where: { id: orderId }, data: { status: derived } });
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: prev, toStatus: derived, note: opts.note, userId: opts.userId } });
    }
  }
  return movable.length;
}

export async function orderPaid(orderId: string) {
  const ps = await db.payment.findMany({ where: { orderId } });
  return ps.reduce((s, p) => s + (p.kind === "REFUND" ? -1 : 1) * Number(p.amount), 0);
}
