import { requireAdminUser } from "@/lib/cms";
export async function AdminEditLink({label,href}:{label:string;href:string}) {
  if (!await requireAdminUser()) return null;
  return <a className="admin-edit-link" href={href} aria-label={label}><span>✎</span>{label}</a>;
}
