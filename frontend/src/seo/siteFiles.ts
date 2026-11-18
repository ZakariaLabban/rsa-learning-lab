/**
 * Files and tags that need the site's public address (robots.txt, sitemap.xml, canonical and
 * link-preview tags). The address is only known once the domain is chosen (#41), so it comes
 * from the SITE_URL environment variable at build time. Without it, nothing here invents an
 * address: the sitemap is skipped and the preview image uses a relative path.
 */

/** A clean https/http origin without a trailing slash, or null when none was given. */
export function siteOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`SITE_URL is not a valid address: ${value}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('SITE_URL must start with https:// (or http:// for local tests).');
  return url.origin;
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildSitemap(origin: string, paths: readonly string[]): string {
  const urls = ['/', ...paths].map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function buildRobots(origin: string | null): string {
  return [
    'User-agent: *',
    'Allow: /',
    ...(origin ? ['', `Sitemap: ${origin}/sitemap.xml`] : []),
    '',
  ].join('\n');
}

/**
 * Tags that depend on the address: absolute link-preview URLs, and a `site-origin` tag that the page
 * reads to set each page's own canonical link and og:url (a single static canonical would point every
 * page at the home page).
 */
export function siteTags(origin: string | null): string {
  const image = `${origin ?? ''}/og-image.png`;
  const tags = [
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ];
  if (origin) tags.unshift(`<meta name="site-origin" content="${origin}" />`);
  return tags.join('\n    ');
}
