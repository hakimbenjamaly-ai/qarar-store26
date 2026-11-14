import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { saveRole, saveUser } from "./actions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("users.manage");
  const [users, roles] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" }, include: { role: true } }),
    db.role.findMany({ orderBy: { system: "desc" }, include: { _count: { select: { users: true } } } }),
  ]);
  type U = (typeof users)[number];
  const UserForm = ({ u }: { u?: U }) => (
    <form action={saveUser} className="grid items-center gap-2 text-sm md:grid-cols-[1fr_1.2fr_1fr_1fr_auto_auto]">
      {u && <input type="hidden" name="id" value={u.id} />}
      <input name="name" defaultValue={u?.name} required placeholder="الاسم" className="input" aria-label="الاسم" />
      <input name="email" type="email" defaultValue={u?.email} required placeholder="البريد" dir="ltr" className="input" aria-label="البريد" />
      <select name="roleId" defaultValue={u?.roleId ?? ""} required className="input" aria-label="الدور">
        <option value="" disabled>الدور</option>
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <input name="password" type="password" minLength={u ? undefined : 10} required={!u} placeholder={u ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور (10+)"} dir="ltr" className="input" autoComplete="new-password" aria-label="كلمة المرور" />
      {u ? <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={u.active} /> نشط</label> : <span />}
      <Submit>{u ? "حفظ" : "إضافة"}</Submit>
    </form>
  );

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="المستخدمون" />
        <Flash {...await searchParams} />
        <div className="card mb-4 p-4"><h2 className="mb-3 font-bold">إضافة مستخدم</h2><UserForm /></div>
        <div className="card divide-y">
          {users.map((u) => (
            <details key={u.id} className="p-3">
              <summary className="cursor-pointer text-sm">
                <b>{u.name}</b> <span dir="ltr">{u.email}</span> · {u.role.name} {!u.active && <span className="badge bg-gray-200">موقوف</span>} <span className="text-xs text-gray-400">آخر دخول: {dateTime(u.lastLoginAt)}</span>
              </summary>
              <div className="mt-3"><UserForm u={u} /></div>
            </details>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-xl font-bold">الأدوار والصلاحيات</h2>
        <div className="space-y-3">
          {[...roles, null].map((r) => (
            <details key={r?.id ?? "new"} className="card p-4" open={!r ? false : undefined}>
              <summary className="cursor-pointer text-sm font-medium">{r ? `${r.name} (${r._count.users} مستخدم)` : "+ دور جديد"}</summary>
              <form action={saveRole} className="mt-3 space-y-3 text-sm">
                {r && <input type="hidden" name="id" value={r.id} />}
                <input name="name" defaultValue={r?.name} required placeholder="اسم الدور" className="input max-w-xs" />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(PERMISSIONS).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2"><input type="checkbox" name="perm" value={k} defaultChecked={r?.permissions.includes(k)} /> {label}</label>
                  ))}
                </div>
                <Submit>حفظ الدور</Submit>
              </form>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
