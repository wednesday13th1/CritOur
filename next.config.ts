import path from 'node:path';
import type { NextConfig } from 'next';
import { securityHeaders, previewFrameSources } from './lib/security-headers';

const deployNow = process.env.CRITOUR_DEPLOY_NOW === '1';
const nextConfig: NextConfig = {
  ...(deployNow ? {
    output: 'standalone' as const,
    webpack(config, { webpack }) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /^cloudflare:workers$/, path.resolve('deploy-now/bindings.ts'),
      ));
      return config;
    },
  } : {}),
  async headers() {
    const rules = [{
      source: '/:path*',
      headers: Object.entries(securityHeaders).map(([key, value]) => ({ key, value })),
    }];
    if (deployNow) {
      for (const source of ['/p/:path*', '/impact/:path*', '/codemate/:path*', '/admin/:path*', '/studio/:path*', '/api/:path*']) {
        rules.push({ source, headers: [{ key: 'Cache-Control', value: 'no-store' }] });
      }
      for (const source of ['/codemate/playground', '/codemate/discover']) {
        rules.push({ source, headers: [
          { key: 'Content-Security-Policy', value: securityHeaders['Content-Security-Policy'] + '; frame-src ' + previewFrameSources },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ] });
      }
    }
    return rules;
  },
};

export default nextConfig;
