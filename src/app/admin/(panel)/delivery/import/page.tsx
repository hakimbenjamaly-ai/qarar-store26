import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ImportForm } from "@/components/admin/import-form";
import { DeliveryTabs } from "../tabs";
import { importStatuses } from "../actions";

export default async function ImportPage() {
  await requireUser("delivery.manage");
  return (
    <div>
      <PageHeader title="استيراد حالات التوصيل من النورس" />
      <DeliveryTabs active="/admin/delivery/import" />
      <div className="card mb-4 space-y-2 p-4 text-sm text-gray-700">
        <p>لا يوجد ربط API مع النورس. طريقة العمل بالملف:</p>
        <ol className="list-decimal space-y-1 pr-5">
          <li>نزّل ملف التوصيلات من «التوصيلات» أو من صفحة دفعة التسليم وأرسله للنورس.</li>
          <li>تعدّل النورس أعمدة: <b>الحالة</b>، <b>المبلغ المحصل</b>، <b>سبب التعذر</b>، <b>رقم البوليصة</b>، <b>اسم المندوب</b> وتعيد الملف بصيغة CSV.</li>
          <li>ارفعه هنا. كل صف يُطبَّق مستقلاً، والصفوف غير الصحيحة تظهر مع السبب دون أن تؤثر على غيرها.</li>
        </ol>
        <p>الحالات المقبولة: خرج للتوصيل، قيد التوزيع، تم التسليم للعميل، تعذر التسليم (مع السبب). «عاد إلى المتجر» يُسجَّل من الإدارة عند استلام الطرد فعلياً. إن تُرك «المبلغ المحصل» فارغاً عند التسليم يُعتبر المبلغ المطلوب كاملاً.</p>
      </div>
      <ImportForm action={importStatuses} />
    </div>
  );
}
