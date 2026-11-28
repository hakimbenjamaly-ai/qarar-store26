"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { saveUpload } from "@/lib/uploads";
import { flashRedirect, num, str } from "@/lib/action-utils";

const P = "/admin/expenses";

export async function addExpense(fd: FormData) {
  const u = await requireUser("payments.manage");
  const amount = num(fd, "amount");
  const category = str(fd, "category") === "أخرى" ? str(fd, "otherCategory") || "أخرى" : str(fd, "category");
  if (!(amount > 0) || !category) flashRedirect(P, { err: "البند والمبلغ مطلوبان" });
  let receiptUrl: string | null = null;
  try {
    receiptUrl = await saveUpload(fd.get("receipt") as File | null, "expenses");
  } catch (e) {
    flashRedirect(P, { err: (e as Error).message });
  }
  const d = str(fd, "date");
  const e = await db.expense.create({
    data: { date: d ? new Date(d + "T12:00:00+02:00") : new Date(), category, amount: new Prisma.Decimal(amount.toFixed(2)), note: str(fd, "note"), receiptUrl, userId: u.id },
  });
  await audit(u.id, "create", "Expense", e.id, undefined, e);
  revalidatePath(P);
  flashRedirect(P, { ok: "سُجّل المصروف" });
}

export async function deleteExpense(fd: FormData) {
  const u = await requireUser("payments.manage");
  const id = str(fd, "id");
  const before = await db.expense.findUnique({ where: { id } });
  if (before) {
    await db.expense.delete({ where: { id } });
    await audit(u.id, "delete", "Expense", id, before, undefined);
  }
  flashRedirect(P, { ok: "حُذف المصروف" });
}
