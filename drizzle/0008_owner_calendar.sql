ALTER TABLE member_accounts ADD login_code_hash text;
--> statement-breakpoint
ALTER TABLE member_accounts ADD disabled_at integer;
--> statement-breakpoint
CREATE TABLE workspace_owners(public_member_id text PRIMARY KEY REFERENCES members(id));
--> statement-breakpoint
INSERT INTO workspace_owners(public_member_id) SELECT id FROM members WHERE id='bed4c0a1-b982-4cb2-99f6-b93a6a72a0e9';
--> statement-breakpoint
UPDATE member_accounts SET login_code_hash=(SELECT token_hash FROM member_activations WHERE public_member_id=member_accounts.public_member_id AND used_at IS NOT NULL ORDER BY used_at DESC LIMIT 1);
--> statement-breakpoint
ALTER TABLE projects ADD admin_only integer NOT NULL DEFAULT 0 CHECK(admin_only IN (0,1));
--> statement-breakpoint
CREATE TABLE calendar_events(id text PRIMARY KEY,title text NOT NULL,event_date text NOT NULL,description text NOT NULL DEFAULT '',is_public integer NOT NULL DEFAULT 0 CHECK(is_public IN (0,1)),created_by text NOT NULL,created_at text NOT NULL);
