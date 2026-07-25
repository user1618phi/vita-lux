import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { listAdminProducts } from "../actions";
import { AdminNav } from "../ui";
import { BulkForm } from "./BulkForm";

export const dynamic = "force-dynamic";

export default async function BulkPage() {
  if (!(await currentAdmin())) redirect("/admin/login");
  const rows = await listAdminProducts();

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-5">
      <h1 className="m-0 mb-4 font-display text-[22px] text-ink">Цены и наличие</h1>
      <AdminNav current="bulk" />
      <div className="mt-4">
        <BulkForm rows={rows} />
      </div>
    </main>
  );
}
