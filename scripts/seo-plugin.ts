import type { Plugin } from 'vite';

/**
 * Search-engine setup generated at build time from VITE_SITE_URL
 * (default: https://resume-creator-ai.vercel.app):
 *  - canonical / Open Graph URLs and the optional Google Search Console
 *    verification tag (VITE_GOOGLE_SITE_VERIFICATION) in index.html;
 *  - robots.txt (public pages indexed, private app pages and the API not);
 *  - sitemap.xml listing the public pages.
 */
export function seo(env: Record<string, string>): Plugin {
  const site = (env.VITE_SITE_URL || 'https://resume-creator-ai.vercel.app').replace(/\/+$/, '');
  const verification = env.VITE_GOOGLE_SITE_VERIFICATION || '';
  const pages = ['/', '/about', '/login'];
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: 'resume-creator-seo',
    transformIndexHtml(html) {
      return html
        .replace(/__SITE_URL__/g, site)
        .replace('<!--__GOOGLE_VERIFICATION__-->', verification ? `<meta name="google-site-verification" content="${verification.replace(/"/g, '')}" />` : '');
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /builder\nDisallow: /resumes\nDisallow: /resume-maker\n\nSitemap: ${site}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
          .map((p) => `  <url><loc>${site}${p === '/' ? '/' : p}</loc><lastmod>${today}</lastmod><changefreq>${p === '/' ? 'weekly' : 'monthly'}</changefreq><priority>${p === '/' ? '1.0' : '0.5'}</priority></url>`)
          .join('\n')}\n</urlset>\n`,
      });
    },
  };
}
