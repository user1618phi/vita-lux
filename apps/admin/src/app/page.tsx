import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";

/* /admin is the address people actually type and bookmark. Send it to the
   products list when signed in, to the login form otherwise. */

export const dynamic = "force-dynamic";

export default async function AdminIndex() {
  redirect((await currentAdmin()) ? "/products" : "/login");
}
