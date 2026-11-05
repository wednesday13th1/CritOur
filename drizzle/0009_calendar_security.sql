ALTER TABLE calendar_events ADD kind text NOT NULL DEFAULT 'event' CHECK(kind IN ('event','deadline'));
--> statement-breakpoint
ALTER TABLE calendar_events ADD completed integer NOT NULL DEFAULT 0 CHECK(completed IN (0,1));
--> statement-breakpoint
ALTER TABLE calendar_events ADD updated_at text;
--> statement-breakpoint
CREATE TABLE protected_media(path text PRIMARY KEY NOT NULL,protected_at text NOT NULL);
--> statement-breakpoint
INSERT OR IGNORE INTO protected_media(path,protected_at)
SELECT cover_image,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM projects WHERE admin_only=1 AND cover_image LIKE '/media/%'
UNION SELECT app_icon,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM projects WHERE admin_only=1 AND app_icon LIKE '/media/%'
UNION SELECT j.value,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM projects p,json_each(CASE WHEN json_valid(p.gallery) THEN p.gallery ELSE '[]' END) j WHERE p.admin_only=1 AND j.type='text' AND j.value LIKE '/media/%';
