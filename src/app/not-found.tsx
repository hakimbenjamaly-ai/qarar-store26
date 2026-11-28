import Link from "next/link";
import { headers } from "next/headers";
import { getLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";

export default async function NotFound() {
  const admin = ((await headers()).get("x-qarar-path") ?? "").startsWith("/admin");
  const t = dict(admin ? "ar" : await getLocale());
  return (
    <div className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div>
        <h1 className="mb-2 text-3xl font-bold">{t.notFound}</h1>
        <Link href={admin ? "/admin" : "/"} className="btn-primary mt-4">{t.backHome}</Link>
      </div>
    </div>
  );
}
