import { integer, primaryKey, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const admins = sqliteTable("admins", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), name: text("name").notNull(), slug: text("slug").notNull().unique(),
  category: text("category").notNull(), shortDescription: text("short_description").notNull(),
  description: text("description"), appIcon: text("app_icon"), projectUrl: text("project_url"), coverImage: text("cover_image"), gallery: text("gallery").notNull().default("[]"),
  year: text("year"), status: text("status").notNull().default("In Development"), featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  teamMembers: text("team_members").notNull().default("[]"), techStack: text("tech_stack").notNull().default("[]"),
  whyWeMadeIt: text("why_we_made_it"), process: text("process"), links: text("links").notNull().default("{}"),
  adminOnly:integer("admin_only",{mode:"boolean"}).notNull().default(false),displayOrder: integer("display_order").notNull().default(0), published: integer("published", { mode: "boolean" }).notNull().default(false), ...timestamps,
});

export const members = sqliteTable("members", {
  id: text("id").primaryKey(), name: text("name").notNull(), role: text("role").notNull(), avatar: text("avatar"),
  bio: text("bio"), skills: text("skills").notNull().default("[]"), socialLinks: text("social_links").notNull().default("{}"),
  displayOrder: integer("display_order").notNull().default(0), visible: integer("visible", { mode: "boolean" }).notNull().default(true), ...timestamps,
});

export const newsPosts = sqliteTable("news_posts", {
  id: text("id").primaryKey(), title: text("title").notNull(), slug: text("slug").notNull().unique(),
  publishDate: text("publish_date").notNull(), coverImage: text("cover_image"), excerpt: text("excerpt"), body: text("body").notNull(),
  relatedProjectId: text("related_project_id"), readMoreUrl: text("read_more_url"), published: integer("published", { mode: "boolean" }).notNull().default(false), ...timestamps,
});

export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey().default(1), teamName: text("team_name").notNull(), siteTitle: text("site_title").notNull(),
  logoText: text("logo_text").notNull(), heroMotto: text("hero_motto").notNull(), heroDescription: text("hero_description").notNull(),
  aboutHeading: text("about_heading").notNull(), aboutStatement: text("about_statement").notNull(), aboutDescription: text("about_description").notNull(),
  heroImage: text("hero_image"), aboutImage: text("about_image"), socialLinks: text("social_links").notNull().default("{}"), contactEmail: text("contact_email"),
  footerText: text("footer_text"), seoTitle: text("seo_title"), seoDescription: text("seo_description"), defaultLanguage: text("default_language").notNull().default("EN"),
  updatedAt: text("updated_at").notNull(),
});

export const activity = sqliteTable("activity", { actorId:text("actor_id"),actorName:text("actor_name"), id: text("id").primaryKey(), label: text("label").notNull(), kind: text("kind").notNull(), createdAt: text("created_at").notNull() });

export const adminLoginAttempts = sqliteTable("admin_login_attempts", {
  id: text("id").primaryKey(),
  window: integer("window").notNull(),
  attempts: integer("attempts").notNull(),
});

// Public profiles remain independent from credentials and private workspace data.
export const memberAccounts = sqliteTable('member_accounts', {
 email:text('email').unique(), id:text('id').primaryKey(), publicMemberId:text('public_member_id').notNull().unique().references(()=>members.id,{onDelete:'restrict'}),
 authUserId:text('auth_user_id').notNull().unique(),displayName:text('display_name').notNull(),avatarUrl:text('avatar_url'),bio:text('bio').notNull().default(''),
 loginCodeHash:text('login_code_hash'),disabledAt:integer('disabled_at'),pinHash:text('pin_hash').notNull(),sessionVersion:integer('session_version').notNull().default(1),activatedAt:text('activated_at').notNull(),createdAt:text('created_at').notNull(),
});
export const invitations=sqliteTable('invitations',{id:text('id').primaryKey(),codeHash:text('code_hash').notNull().unique(),expiresAt:integer('expires_at').notNull(),revokedAt:integer('revoked_at'),maxUses:integer('max_uses').notNull(),usedCount:integer('used_count').notNull().default(0)});
export const memberActivations=sqliteTable('member_activations',{id:text('id').primaryKey(),publicMemberId:text('public_member_id').notNull().references(()=>members.id,{onDelete:'cascade'}),tokenHash:text('token_hash').notNull().unique(),expiresAt:integer('expires_at').notNull(),usedAt:integer('used_at')});
export const workspaceSessions=sqliteTable('workspace_sessions',{tokenHash:text('token_hash').primaryKey(),authUserId:text('auth_user_id').notNull(),purpose:text('purpose').notNull(),version:integer('version').notNull().default(0),verifiedAt:integer('verified_at').notNull().default(0),expiresAt:integer('expires_at').notNull()});
export const teamMessages=sqliteTable('team_messages',{deletedAt:text('deleted_at'),clientId:text('client_id'),id:text('id').primaryKey(),senderId:text('sender_id').notNull().references(()=>memberAccounts.id),content:text('content').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),replyToMessageId:text('reply_to_message_id')},t=>[uniqueIndex('team_message_client').on(t.senderId,t.clientId)]);
export const directConversations=sqliteTable('direct_conversations',{id:text('id').primaryKey(),pairKey:text('pair_key').notNull().unique(),createdAt:text('created_at').notNull()});
export const directConversationParticipants=sqliteTable('direct_conversation_participants',{conversationId:text('conversation_id').notNull().references(()=>directConversations.id),memberId:text('member_id').notNull().references(()=>memberAccounts.id)},t=>[primaryKey({columns:[t.conversationId,t.memberId]})]);
export const directMessages=sqliteTable('direct_messages',{deletedAt:text('deleted_at'),clientId:text('client_id'),id:text('id').primaryKey(),conversationId:text('conversation_id').notNull().references(()=>directConversations.id),senderId:text('sender_id').notNull().references(()=>memberAccounts.id),content:text('content').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()},t=>[uniqueIndex('direct_message_client').on(t.senderId,t.clientId)]);
export const messageReactions=sqliteTable('message_reactions',{messageId:text('message_id').notNull().references(()=>teamMessages.id),memberId:text('member_id').notNull().references(()=>memberAccounts.id),emoji:text('emoji').notNull()},t=>[primaryKey({columns:[t.messageId,t.memberId,t.emoji]})]);
export const messageReads=sqliteTable('message_reads',{memberId:text('member_id').notNull().references(()=>memberAccounts.id),channel:text('channel').notNull(),readAt:text('read_at').notNull()},t=>[primaryKey({columns:[t.memberId,t.channel]})]);

export const allowedEmails=sqliteTable('allowed_emails',{
 email:text('email').primaryKey(),publicMemberId:text('public_member_id').notNull().unique().references(()=>members.id,{onDelete:'restrict'}),
 createdAt:text('created_at').notNull(),disabledAt:text('disabled_at'),updatedBy:text('updated_by').notNull(),
});
export const auditLogs=sqliteTable('audit_logs',{
 id:text('id').primaryKey(),actorId:text('actor_id'),actorName:text('actor_name'),action:text('action').notNull(),resource:text('resource').notNull(),createdAt:text('created_at').notNull(),
});
export const emailChallenges=sqliteTable('email_challenges',{
 tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),providerUserId:text('provider_user_id').notNull(),expiresAt:integer('expires_at').notNull(),verifiedAt:integer('verified_at').notNull(),usedAt:integer('used_at'),
});
export const workspaceBootstrap=sqliteTable('workspace_bootstrap',{id:integer('id').primaryKey()});
export const googleLoginFlows=sqliteTable('google_login_flows',{
 tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),verifier:text('verifier').notNull(),nonce:text('nonce').notNull(),expiresAt:integer('expires_at').notNull(),reauthAccountId:text('reauth_account_id'),
});

export const workspaceOwners=sqliteTable('workspace_owners',{publicMemberId:text('public_member_id').primaryKey().references(()=>members.id)});
export const calendarEvents=sqliteTable('calendar_events',{id:text('id').primaryKey(),title:text('title').notNull(),eventDate:text('event_date').notNull(),kind:text('kind').notNull().default('event'),completed:integer('completed',{mode:'boolean'}).notNull().default(false),updatedAt:text('updated_at'),description:text('description').notNull().default(''),isPublic:integer('is_public',{mode:'boolean'}).notNull().default(false),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull()});

export const protectedMedia=sqliteTable('protected_media',{path:text('path').primaryKey().notNull(),protectedAt:text('protected_at').notNull()});

// Studio access is independent of CMS roles and public project team labels.
export const studioAdmins=sqliteTable('studio_admins',{
 id:integer('id').primaryKey(),accountId:text('account_id').notNull().unique().references(()=>memberAccounts.id,{onDelete:'restrict'}),
 authUserId:text('auth_user_id').notNull().unique(),createdAt:text('created_at').notNull(),
});
export const studioProjects=sqliteTable('studio_projects',{
 id:text('id').primaryKey(),name:text('name').notNull(),description:text('description').notNull().default(''),
 cmsProjectId:text('cms_project_id').references(()=>projects.id,{onDelete:'set null'}),
 createdBy:text('created_by').notNull().references(()=>memberAccounts.id,{onDelete:'restrict'}),
 revision:integer('revision').notNull().default(0),archivedAt:text('archived_at'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
});
export const studioProjectMembers=sqliteTable('studio_project_members',{
 projectId:text('project_id').notNull().references(()=>studioProjects.id,{onDelete:'cascade'}),
 accountId:text('account_id').notNull().references(()=>memberAccounts.id,{onDelete:'restrict'}),
 addedBy:text('added_by').notNull().references(()=>memberAccounts.id,{onDelete:'restrict'}),joinedAt:text('joined_at').notNull(),
},t=>[primaryKey({columns:[t.projectId,t.accountId]})]);
export const studioActivity=sqliteTable('studio_activity',{
 id:text('id').primaryKey(),projectId:text('project_id').references(()=>studioProjects.id,{onDelete:'cascade'}),
 actorId:text('actor_id').notNull().references(()=>memberAccounts.id,{onDelete:'restrict'}),
 action:text('action').notNull(),targetAccountId:text('target_account_id'),createdAt:text('created_at').notNull(),
});

export const studioChannels=sqliteTable('studio_channels',{
 id:text('id').primaryKey(),projectId:text('project_id').notNull().references(()=>studioProjects.id,{onDelete:'cascade'}),name:text('name').notNull(),
 archivedAt:text('archived_at'),createdBy:text('created_by').notNull().references(()=>memberAccounts.id),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('studio_channel_name').on(t.projectId,t.name)]);
export const studioMessages=sqliteTable('studio_messages',{
 seq:integer('seq').primaryKey({autoIncrement:true}),id:text('id').notNull().unique(),projectId:text('project_id').notNull().references(()=>studioProjects.id,{onDelete:'cascade'}),
 channelId:text('channel_id').notNull().references(()=>studioChannels.id),parentId:text('parent_id'),senderId:text('sender_id').notNull().references(()=>memberAccounts.id),
 content:text('content').notNull().default(''),clientId:text('client_id').notNull(),deletedAt:text('deleted_at'),version:integer('version').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('studio_message_client').on(t.senderId,t.clientId),index('studio_message_channel_seq').on(t.channelId,t.seq)]);
export const studioReactions=sqliteTable('studio_reactions',{messageId:text('message_id').notNull().references(()=>studioMessages.id),accountId:text('account_id').notNull().references(()=>memberAccounts.id),emoji:text('emoji').notNull()},t=>[primaryKey({columns:[t.messageId,t.accountId,t.emoji]})]);
export const studioReads=sqliteTable('studio_reads',{channelId:text('channel_id').notNull().references(()=>studioChannels.id),accountId:text('account_id').notNull().references(()=>memberAccounts.id),lastSeq:integer('last_seq').notNull().default(0)},t=>[primaryKey({columns:[t.channelId,t.accountId]})]);
export const studioTasks=sqliteTable('studio_tasks',{
 id:text('id').primaryKey(),projectId:text('project_id').notNull().references(()=>studioProjects.id,{onDelete:'cascade'}),title:text('title').notNull(),description:text('description').notNull().default(''),
 status:text('status').notNull().default('todo'),priority:text('priority').notNull().default('medium'),assigneeIds:text('assignee_ids').notNull().default('[]'),dueDate:text('due_date'),
 sourceMessageId:text('source_message_id').unique().references(()=>studioMessages.id),githubUrl:text('github_url'),version:integer('version').notNull().default(1),mutationId:text('mutation_id').notNull(),
 clientId:text('client_id').notNull(),createdBy:text('created_by').notNull().references(()=>memberAccounts.id),updatedBy:text('updated_by').notNull().references(()=>memberAccounts.id),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('studio_task_client').on(t.projectId,t.createdBy,t.clientId)]);
export const studioTaskComments=sqliteTable('studio_task_comments',{id:text('id').primaryKey(),taskId:text('task_id').notNull().references(()=>studioTasks.id),projectId:text('project_id').notNull().references(()=>studioProjects.id),accountId:text('account_id').notNull().references(()=>memberAccounts.id),content:text('content').notNull(),clientId:text('client_id').notNull(),createdAt:text('created_at').notNull()},t=>[uniqueIndex('studio_comment_client').on(t.accountId,t.clientId)]);
export const studioNotifications=sqliteTable('studio_notifications',{
 id:text('id').primaryKey(),projectId:text('project_id').notNull().references(()=>studioProjects.id,{onDelete:'cascade'}),recipientId:text('recipient_id').notNull().references(()=>memberAccounts.id),
 kind:text('kind').notNull(),targetId:text('target_id').notNull(),channelId:text('channel_id'),title:text('title').notNull(),eventKey:text('event_key').notNull(),readAt:text('read_at'),availableAt:text('available_at').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('studio_notification_event').on(t.recipientId,t.eventKey)]);
export const studioFiles=sqliteTable('studio_files',{
 id:text('id').primaryKey(),storageKey:text('storage_key').notNull().unique(),scopeKind:text('scope_kind').notNull(),scopeId:text('scope_id').notNull(),projectId:text('project_id').references(()=>studioProjects.id),
 studioMessageId:text('studio_message_id').references(()=>studioMessages.id),directMessageId:text('direct_message_id').references(()=>directMessages.id),teamMessageId:text('team_message_id').references(()=>teamMessages.id),
 uploadedBy:text('uploaded_by').notNull().references(()=>memberAccounts.id),filename:text('filename').notNull(),mime:text('mime').notNull(),bytes:integer('bytes').notNull(),createdAt:text('created_at').notNull(),
});
