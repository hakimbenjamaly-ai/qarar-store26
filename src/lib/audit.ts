import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { clientIp } from "./auth";

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId = "",
  before?: unknown,
  after?: unknown,
  tx: Prisma.TransactionClient = db,
) {
  const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));
  await tx.auditLog.create({
    data: { userId, action, entity, entityId, before: json(before), after: json(after), ip: await clientIp().catch(() => "") },
  });
}
