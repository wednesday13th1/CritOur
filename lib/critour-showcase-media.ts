import {RequestError} from './request-security';

export const showcaseCategories = {
  web: "Webアプリ", ios: "iOSアプリ", android: "Androidアプリ", game: "ゲーム", design: "デザイン", other: "その他",
} as const;

export function categoryLabel(category: string, kind?: string) {
  if (category === 'app') return kind === 'ios' ? "iOSアプリ" : "Webアプリ";
  if (category === 'learning') return "その他";
  return showcaseCategories[category as keyof typeof showcaseCategories] || "その他";
}

export function showcaseLink(value: unknown, kind: 'demo' | 'video' | 'github') {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) throw new RequestError("https:// から始まる正しいURLを入力してください。");
  let url: URL;
  try { url = new URL(value); } catch { throw new RequestError("https:// から始まる正しいURLを入力してください。"); }
  const host = url.hostname;
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host) ||
      /\.(localhost|local|internal|test|invalid|example|onion)$/i.test(host)) {
    throw new RequestError("誰でもアクセスできる https:// のURLを入力してください。");
  }
  if (kind === 'github' && (host !== 'github.com' || !/^\/[a-z0-9-]+\/[a-z0-9_.-]+\/?$/i.test(url.pathname) || url.search || url.hash)) {
    throw new RequestError("公開されているGitHubリポジトリのURLを入力してください。");
  }
  return url.href;
}

export type MediaRow = {
  media_listing_id: string | null; cover_id: string | null; screenshots: string | null;
  demo_url: string | null; video_url: string | null; github_url: string | null;
  after_asset_id: string | null; preview_url: string | null;
};

export function showcaseMedia(row: MediaRow) {
  const cover = row.media_listing_id ? row.cover_id : row.after_asset_id;
  return {
    cover,
    screenshots: (JSON.parse(row.screenshots || '[]') as string[]).filter(id => id !== cover),
    demo: row.media_listing_id ? row.demo_url : row.preview_url,
    video: row.video_url,
    github: row.github_url,
  };
}
