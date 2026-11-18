import { describe, expect, it } from 'vitest';
import { GROUPS } from '../features/lecture/lessons';
import { buildRobots, buildSitemap, siteOrigin, siteTags } from './siteFiles';

describe('site files', () => {
  it('reads the address safely', () => {
    expect(siteOrigin(undefined)).toBeNull();
    expect(siteOrigin('  ')).toBeNull();
    expect(siteOrigin('https://rsa-lab.example/some/path/')).toBe('https://rsa-lab.example');
    expect(() => siteOrigin('not a url')).toThrow('SITE_URL is not a valid address');
    expect(() => siteOrigin('ftp://rsa-lab.example')).toThrow('https://');
  });
  it('lists the home page and every lesson once in the sitemap', () => {
    const paths = GROUPS.flatMap((group) => group.lessons.map((lesson) => lesson.path));
    expect(new Set(paths).size).toBe(paths.length);
    const xml = buildSitemap('https://rsa-lab.example', paths);
    expect(xml).toContain('<loc>https://rsa-lab.example/</loc>');
    for (const path of paths) expect(xml).toContain(`<loc>https://rsa-lab.example${path}</loc>`);
    expect(xml.match(/<url>/g)).toHaveLength(paths.length + 1);
  });
  it('escapes special characters in addresses', () => {
    expect(buildSitemap('https://x.example', ['/a&b'])).toContain('/a&amp;b');
  });
  it('writes robots.txt with a sitemap line only when the address is known', () => {
    expect(buildRobots(null)).toBe('User-agent: *\nAllow: /\n');
    expect(buildRobots('https://x.example')).toContain('Sitemap: https://x.example/sitemap.xml');
  });
  it('never invents an address for the link preview', () => {
    expect(siteTags(null)).not.toContain('site-origin');
    expect(siteTags(null)).toContain('content="/og-image.png"');
    const withSite = siteTags('https://x.example');
    expect(withSite).toContain('<meta name="site-origin" content="https://x.example" />');
    expect(withSite).toContain('content="https://x.example/og-image.png"');
    // The canonical link is per page and set in the browser, never one static link for every page.
    expect(withSite).not.toContain('canonical');
  });
});
