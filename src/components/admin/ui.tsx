import Link from "next/link";

export function PageHeader({ title, actions, back }: { title: string; actions?: React.ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        {back && <Link href={back} className="text-sm text-gray-500 hover:text-brand-700">→ رجوع</Link>}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return <div className={`mb-4 rounded-lg p-3 text-sm ${err ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{err ?? ok}</div>;
}

export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, href, tone = "" }: { label: string; value: React.ReactNode; href?: string; tone?: string }) {
  const body = (
    <div className={`card p-4 ${href ? "hover:border-brand-600" : ""}`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-gray-500">{children}</div>;
}
