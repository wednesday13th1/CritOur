import{AdminEditLink}from"@/components/admin-edit-link";
export default function NewsLayout({children}:{children:React.ReactNode}){return <>{children}<AdminEditLink label="Edit post" href="/admin"/></>}
