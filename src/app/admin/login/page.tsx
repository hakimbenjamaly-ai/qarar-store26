import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");
  return (
    <div className="grid min-h-screen place-items-center bg-gray-100 p-4">
      <LoginForm />
    </div>
  );
}
