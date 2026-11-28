"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { bool, flashRedirect, str } from "@/lib/action-utils";

const P = "/admin/users";

export async function saveUser(fd: FormData) {
  const u = await requireUser("users.manage");
  const id = str(fd, "id");
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const roleId = str(fd, "roleId");
  const password = String(fd.get("password") ?? "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !roleId) flashRedirect(P, { err: "الاسم والبريد والدور مطلوبة" });
  if ((!id || password) && password.length < 10) flashRedirect(P, { err: "كلمة المرور يجب ألا تقل عن 10 أحرف" });
  if (await db.user.findFirst({ where: { email, NOT: id ? { id } : undefined } })) flashRedirect(P, { err: "البريد مستخدم" });
  const active = id ? bool(fd, "active") : true;
  if (id === u.id && !active) flashRedirect(P, { err: "لا يمكنك إيقاف حسابك" });
  if (id === u.id) {
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role?.permissions.includes("users.manage")) flashRedirect(P, { err: "لا يمكنك سحب صلاحية إدارة المستخدمين من نفسك" });
  }
  const deliveryPartnerId = str(fd, "deliveryPartnerId") || null;
  const data = { name, email, roleId, active, deliveryPartnerId, ...(password ? { passwordHash: await hashPassword(password) } : {}) };
  if (id) {
    const before = await db.user.findUnique({ where: { id }, select: { name: true, email: true, roleId: true, active: true } });
    await db.user.update({ where: { id }, data });
    if (!active || password) await db.session.deleteMany({ where: { userId: id } });
    await audit(u.id, "update", "User", id, before, { name, email, roleId, active, passwordChanged: !!password });
  } else {
    const nu = await db.user.create({ data: { ...data, passwordHash: data.passwordHash! } });
    await audit(u.id, "create", "User", nu.id, undefined, { name, email, roleId });
  }
  revalidatePath(P);
  flashRedirect(P, { ok: "تم حفظ المستخدم" });
}

export async function saveRole(fd: FormData) {
  const u = await requireUser("users.manage");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) flashRedirect(P, { err: "اسم الدور مطلوب" });
  const permissions = fd.getAll("perm").map(String).filter((p) => (ALL_PERMISSIONS as string[]).includes(p));
  const before = id ? await db.role.findUnique({ where: { id } }) : null;
  if (before?.key === "super_admin" && !permissions.includes("users.manage")) flashRedirect(P, { err: "دور المدير العام يجب أن يحتفظ بصلاحية إدارة المستخدمين" });
  if (id) {
    await db.role.update({ where: { id }, data: { name, permissions } });
  } else {
    const key = `custom_${Date.now()}`;
    await db.role.create({ data: { key, name, permissions } });
  }
  await audit(u.id, id ? "update" : "create", "Role", id || name, before, { name, permissions });
  revalidatePath(P);
  flashRedirect(P, { ok: "تم حفظ الدور" });
}
