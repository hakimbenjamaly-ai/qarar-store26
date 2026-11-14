// إنشاء حساب المدير العام الأول:
// npm run create-admin -- --email you@example.com --name "الاسم" --password "كلمة مرور قوية"
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.toLowerCase().trim();
  const name = arg("name") ?? "المدير العام";
  const password = arg("password");
  if (!email || !password) throw new Error("الاستخدام: npm run create-admin -- --email EMAIL --password PASSWORD [--name NAME]");
  if (password.length < 10) throw new Error("كلمة المرور يجب ألا تقل عن 10 أحرف");
  const role = await db.role.findUnique({ where: { key: "super_admin" } });
  if (!role) throw new Error("شغّل npm run db:seed أولاً");
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.upsert({ where: { email }, create: { email, name, passwordHash, roleId: role.id }, update: { passwordHash, roleId: role.id, active: true } });
  console.log(`تم إنشاء/تحديث حساب المدير: ${email}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
