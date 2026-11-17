import { redirect } from "next/navigation";

/**
 * Public entry-point alias for V1 Provider.
 * Redirect only to the V1 admin login; never touch V2, V3 or WiV1 routes.
 */
export default function V1ProviderEntry() {
  redirect("/admin/provider");
}
