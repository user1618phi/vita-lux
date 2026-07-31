import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { logoutAction } from "../actions";
import { AdminNav, PageShell } from "../ui";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  return (
    <PageShell
      title="Мой профиль"
      nav={<AdminNav current="account" role={admin.role} username={admin.username} logoutAction={logoutAction} />}
    >
      <p className="m-0 mb-4 font-sans" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
        {admin.username} · {admin.role === "owner" ? "владелец" : "менеджер"}
      </p>
      <ChangePasswordForm />
    </PageShell>
  );
}
