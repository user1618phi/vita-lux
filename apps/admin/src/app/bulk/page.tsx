import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { listAdminProducts, logoutAction } from "../actions";
import { AdminNav, PageShell } from "../ui";
import { BulkForm } from "./BulkForm";

export const dynamic = "force-dynamic";

export default async function BulkPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  const rows = await listAdminProducts();

  return (
    <PageShell
      title="Цены и наличие"
      width="wide"
      nav={
        <AdminNav current="bulk" role={admin.role} username={admin.username} logoutAction={logoutAction} />
      }
    >
      <BulkForm rows={rows} />
    </PageShell>
  );
}
