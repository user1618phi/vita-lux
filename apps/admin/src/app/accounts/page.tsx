import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { can, currentAdmin } from "@/lib/auth";
import { logoutAction } from "../actions";

import { listAccounts } from "./actions";
import { AccountsView } from "./AccountsView";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  if (!can(admin.role, "accounts")) redirect("/products?denied=1");

  const rows = await listAccounts();

  return (
    <PageShell
      title="Доступ"
    >
      <AccountsView rows={rows} currentId={admin.id} />
    </PageShell>
  );
}
