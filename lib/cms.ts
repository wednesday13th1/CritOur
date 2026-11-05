import { env } from "cloudflare:workers";

export type CmsData = { settings: any; projects: any[]; members: any[]; news: any[] };
const sampleSettings = {
  teamName: "motto.", siteTitle: "motto. — Student Creative Studio", logoText: "motto.",
  heroMotto: "We make little ideas real.", heroDescription: "A student-led creative development team building apps, web experiences, and small ideas that matter.",
  aboutHeading: "Who we are", aboutStatement: "We’re students who love making things.",
  aboutDescription: "motto. is a student-led app development team in Japan. We turn everyday ideas into apps, websites and interactive experiences — learning through designing, building, failing, and trying again.",
  socialLinks: JSON.stringify({ instagram: "#", github: "#" }), contactEmail: "hello@motto.team", footerText: "Made after school, with care.", seoTitle: "motto. — Student Creative Studio", seoDescription: "Apps, websites and small ideas made by students in Japan.", defaultLanguage: "EN",
};

function parse(row: any) {
  if (!row) return row;
  const result = { ...row };
  for (const key of ["gallery", "team_members", "tech_stack", "links", "skills", "social_links"]) {
    if (key in result) { try { result[key] = JSON.parse(result[key] || (key === "links" || key === "social_links" ? "{}" : "[]")); } catch {} }
  }
  return result;
}

export async function ensureSeeded() {
  const db = env.DB!;
  const found = await db.prepare("SELECT id FROM site_settings WHERE id = 1").first();
  if (found) return;
  const now = new Date().toISOString();
  const statements = [
    db.prepare("INSERT OR IGNORE INTO site_settings (id,team_name,site_title,logo_text,hero_motto,hero_description,about_heading,about_statement,about_description,social_links,contact_email,footer_text,seo_title,seo_description,default_language,updated_at) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(sampleSettings.teamName,sampleSettings.siteTitle,sampleSettings.logoText,sampleSettings.heroMotto,sampleSettings.heroDescription,sampleSettings.aboutHeading,sampleSettings.aboutStatement,sampleSettings.aboutDescription,sampleSettings.socialLinks,sampleSettings.contactEmail,sampleSettings.footerText,sampleSettings.seoTitle,sampleSettings.seoDescription,sampleSettings.defaultLanguage,now),
    db.prepare("INSERT OR IGNORE INTO projects (id,name,slug,category,short_description,description,gallery,year,status,featured,team_members,tech_stack,why_we_made_it,process,links,display_order,published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind("snapta","Snapta","snapta","iOS App","Learning through words, photos and play.","A playful learning app that turns the world around you into a collection of words and discoveries.","[]","2026","Released",1,"[]",JSON.stringify(["Swift","SwiftUI","Vision"]),"We wanted learning new words to feel like collecting tiny memories.","We began with paper prototypes, then tested camera-first flows with classmates.",JSON.stringify({website:"#"}),1,1,now,now),
    db.prepare("INSERT OR IGNORE INTO projects (id,name,slug,category,short_description,description,gallery,year,status,featured,team_members,tech_stack,why_we_made_it,process,links,display_order,published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind("filmy","Filmy","filmy","Web App","Turning everyday colors into your own artwork.","An experimental web canvas inspired by film grain, light leaks, and ordinary color.","[]","2026","In Development",1,"[]",JSON.stringify(["React","Canvas","TypeScript"]),"Creative tools should invite play before they ask for expertise.","A growing set of visual experiments shaped into one small tool.",JSON.stringify({website:"#"}),2,1,now,now),
    db.prepare("INSERT OR IGNORE INTO projects (id,name,slug,category,short_description,description,gallery,year,status,featured,team_members,tech_stack,why_we_made_it,process,links,display_order,published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind("michi","Michi","michi","Website","A calmer way to remember the places between places.","A pocket-sized map journal for overlooked routes and small discoveries.","[]","2025","Released",1,"[]",JSON.stringify(["Next.js","MapKit","Figma"]),"The walk home can be as memorable as the destination.","Interviews, route sketches, and a quiet visual system.",JSON.stringify({github:"#"}),3,1,now,now),
    db.prepare("INSERT OR IGNORE INTO members (id,name,role,bio,skills,social_links,display_order,visible,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind("saki","Saki","Developer / Designer","Draws interfaces, writes Swift, and notices the small details.",JSON.stringify(["Swift","UI/UX","Web"]),JSON.stringify({github:"#"}),1,1,now,now),
    db.prepare("INSERT OR IGNORE INTO members (id,name,role,bio,skills,social_links,display_order,visible,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind("ren","Ren","Web Developer","Turns sketches into fast, thoughtful experiences.",JSON.stringify(["React","Motion","Creative code"]),JSON.stringify({github:"#"}),2,1,now,now),
    db.prepare("INSERT OR IGNORE INTO members (id,name,role,bio,skills,social_links,display_order,visible,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind("yui","Yui","Writer / Researcher","Finds the human story behind each idea.",JSON.stringify(["Research","Copy","Planning"]),JSON.stringify({instagram:"#"}),3,1,now,now),
    db.prepare("INSERT OR IGNORE INTO news_posts (id,title,slug,publish_date,excerpt,body,published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind("n1","Snapta is out in the world","snapta-is-out","2026-06-18","Our first iOS app has left the classroom.","<p>After months of testing, redrawing and starting over, Snapta is ready to meet its first learners.</p>",1,now,now),
    db.prepare("INSERT OR IGNORE INTO news_posts (id,title,slug,publish_date,excerpt,body,published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind("n2","A tiny studio, after school","a-tiny-studio","2026-05-02","Why we decided to make things together.","<p>We started with a shared note full of impossible ideas. motto. is our place to try them anyway.</p>",1,now,now),
  ];
  await db.batch(statements);
}

export async function getCmsData(includeDrafts = false): Promise<CmsData> {
  await ensureSeeded();
  const db = env.DB!;
  const suffix = includeDrafts ? "" : " WHERE published = 1";
  const [settings, projects, members, news] = await Promise.all([
    db.prepare("SELECT * FROM site_settings WHERE id = 1").first(),
    db.prepare(`SELECT * FROM projects${includeDrafts ? "" : " WHERE published = 1 AND admin_only = 0"} ORDER BY display_order, updated_at DESC`).all(),
    db.prepare(`SELECT * FROM members${includeDrafts ? "" : " WHERE visible = 1"} ORDER BY display_order, updated_at DESC`).all(),
    db.prepare(`SELECT * FROM news_posts${suffix} ORDER BY publish_date DESC`).all(),
  ]);
  return { settings: parse(settings), projects: projects.results.map(parse), members: members.results.map(parse), news: news.results.map(parse) };
}

export async function requireAdminUser() {
  const { siteAdminUser } = await import("@/lib/site-access");
  return siteAdminUser();
}
