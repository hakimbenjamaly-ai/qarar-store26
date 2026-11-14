"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clearLoginFailures, clientIp, createSession, destroySession, getCurrentUser, loginBlocked, recordLoginFailure, verifyPassword } from "@/lib/auth";

export async function login(_: unknown, fd: FormData): Promise<{ error: string }> {
  const email = String(fd.get("email") ?? "").toLowerCase().trim();
  const password = String(fd.get("password") ?? "");
  const key = `${await clientIp()}|${email}`;
  if (loginBlocked(key)) return { error: "محاولات كثيرة. حاول بعد 15 دقيقة." };
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    recordLoginFailure(key);
    return { error: "البريد أو كلمة المرور غير صحيحة" };
  }
  clearLoginFailures(key);
  await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(user.id, "login", "User", user.id);
  redirect("/admin");
}

export async function logout() {
  const u = await getCurrentUser();
  if (u) await audit(u.id, "logout", "User", u.id);
  await destroySession();
  redirect("/admin/login");
}
