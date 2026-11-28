"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { getDict } from "@/lib/locale";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim(),
  subject: z.string().trim().max(150).default(""),
  message: z.string().trim().min(5).max(2000),
});

export async function sendContact(_: unknown, fd: FormData): Promise<{ ok: boolean; msg: string }> {
  const { t } = await getDict();
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, msg: t.errContact };
  const phone = normalizePhone(p.data.phone);
  if (!phone) return { ok: false, msg: t.phoneInvalid };
  await db.contactMessage.create({ data: { ...p.data, phone } });
  await db.notification.create({ data: { event: "contact.new", title: `رسالة جديدة من ${p.data.name}`, link: "/admin/messages" } });
  return { ok: true, msg: t.contactSent };
}
