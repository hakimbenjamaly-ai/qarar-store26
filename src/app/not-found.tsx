import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div>
        <h1 className="mb-2 text-3xl font-bold">الصفحة غير موجودة</h1>
        <Link href="/" className="btn-primary mt-4">العودة للرئيسية</Link>
      </div>
    </div>
  );
}
