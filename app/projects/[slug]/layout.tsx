import{AdminEditLink}from"@/components/admin-edit-link";
export default function ProjectLayout({children}:{children:React.ReactNode}){return <>{children}<AdminEditLink label="Edit project" href="/admin"/></>}
