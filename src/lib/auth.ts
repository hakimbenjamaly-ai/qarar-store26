import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { Permission } from "./permissions";

const COOKIE = "qarar_session";
const SESSION_DAYS = 7;

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(COOKIE);
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  permissions: Set<string>;
  deliveryPartnerId: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: { include: { role: true } } } });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return {
    id: s.user.id,
    name: s.user.name,
    email: s.user.email,
    roleName: s.user.role.name,
    permissions: new Set(s.user.role.permissions),
    deliveryPartnerId: s.user.deliveryPartnerId,
  };
}

export function can(user: CurrentUser | null, p: Permission) {
  return !!user && user.permissions.has(p);
}

/** للصفحات ووظائف الخادم: يعيد التوجيه لتسجيل الدخول أو يرفض إن لم تتوفر الصلاحية */
export async function requireUser(p?: Permission): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  if (p && !u.permissions.has(p)) redirect("/admin?denied=1");
  return u;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
}

// حد بسيط لمحاولات الدخول الفاشلة (في الذاكرة، لكل خادم)
const attempts = new Map<string, { n: number; until: number }>();
export function loginBlocked(key: string) {
  const a = attempts.get(key);
  return !!a && a.n >= 5 && a.until > Date.now();
}
export function recordLoginFailure(key: string) {
  const a = attempts.get(key);
  const now = Date.now();
  if (!a || a.until < now) attempts.set(key, { n: 1, until: now + 15 * 60e3 });
  else a.n++;
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
