declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CODEMATE_ENABLED?: string;
    WORKSPACE_PROVISION_KEY?: string;
    WORKSPACE_OWNER_RECOVERY?: string;
    INITIAL_ADMIN_EMAIL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    AUTH_BASE_URL?: string;
    ADMIN_PASSCODE?: string;
    ADMIN_SESSION_SECRET?: string;
    BUCKET?: R2Bucket;
  }
}
