import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { currentAdmin } from "@/lib/auth";
import { logoutAction } from "../actions";

import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  return (
    <PageShell
      title="Мой профиль"
    >
      <p className="m-0 mb-4 font-sans" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
        {admin.username} · {admin.role === "owner" ? "владелец" : "менеджер"}
      </p>
      <ChangePasswordForm />
    </PageShell>
  );
}
