export const securityHeaders={
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data: blob:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://*.chatgpt.site",
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Strict-Transport-Security':'max-age=31536000',
};

export const previewFrameSources = 'https://*.vercel.app https://*.netlify.app https://*.pages.dev https://*.github.io https://*.web.app https://*.firebaseapp.com https://*.chatgpt.site https://*.lolipop-now.app';
