import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { DELIVERY_STATUS_LABELS, settleCandidates } from "@/lib/delivery";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { DeliveryTabs } from "../../tabs";
import { createSettlement } from "../../actions";
import { SettleForm } from "./settle-form";

export default async function NewSettlement({ searchParams }: { searchParams: Promise<{ partner?: string; ok?: string; err?: string }> }) {
  await requireUser("payments.manage");
  const sp = await searchParams;
  const partners = await db.deliveryPartner.findMany({ orderBy: { name: "asc" } });
  const partnerId = sp.partner ?? partners[0]?.id;
  const rows = partnerId ? await settleCandidates(partnerId) : [];
  return (
    <div>
      <PageHeader title="تسوية جديدة مع شركة التوزيع" back="/admin/delivery/settlements" />
      <DeliveryTabs active="/admin/delivery/settlements" />
      <Flash ok={sp.ok} err={sp.err} />
      {partners.length > 1 && (
        <div className="mb-4 flex gap-2 text-sm">{partners.map((p) => <Link key={p.id} href={`?partner=${p.id}`} className={p.id === partnerId ? "btn-primary" : "btn-outline"}>{p.name}</Link>)}</div>
      )}
      <p className="mb-4 text-sm text-gray-600">التوصيلات المسلّمة أو المرتجعة التي لم تدخل تسوية. سجّل ما استلمته فعلاً من النورس؛ تُضاف المبالغ المحصلة كدفعات على طلبات العملاء، ويظهر أي فرق بين المتوقع والمستلم.</p>
      {!partnerId || rows.length === 0 ? <Empty>لا توجد توصيلات بانتظار التسوية.</Empty> : (
        <SettleForm
          partnerId={partnerId}
          action={createSettlement}
          rows={rows.map((d) => ({ id: d.id, number: d.number, order: d.order.number, name: d.order.shipName, status: DELIVERY_STATUS_LABELS[d.status], date: dateOnly(d.deliveredAt ?? d.updatedAt), collected: Number(d.collected ?? 0), fee: Number(d.fee) }))}
        />
      )}
    </div>
  );
}
