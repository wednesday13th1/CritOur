// Existing SQLite rowids give legacy chat a server receipt sequence without a migration.
// Persist the immutable message ID as the cursor, resolving its rowid at query time.
// Tombstones retain that anchor. Old timestamp-only cursors remain readable.
export function unreadAfter(table:'team_messages'|'direct_messages',alias:string,read:string){return `CASE WHEN COALESCE(${read},'') LIKE 'id:%' THEN ${alias}.rowid>COALESCE((SELECT cursor_message.rowid FROM ${table} cursor_message WHERE cursor_message.id=substr(${read},4)),0) ELSE ${alias}.created_at>COALESCE(${read},'') END`;}
