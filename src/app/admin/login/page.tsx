import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin/products");

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-[380px]">
        <h1 className="m-0 mb-1 font-display text-[26px] text-ink">Vita Lux</h1>
        <p className="m-0 mb-7 font-sans text-[14px] text-slate">Панель управления каталогом</p>
        <LoginForm />
      </div>
    </main>
  );
}
