export const SITE_NAME = 'RSA Lab';
export const DEFAULT_TITLE = `${SITE_NAME} · Learn RSA step by step`;
export const DEFAULT_DESCRIPTION =
  'Learn RSA one step at a time: the GCD, inverse, fast-power, Miller–Rabin and CRT tables, then RSA by hand, signatures, attacks and real encryption in your browser.';

function setMeta(name: string, content: string | null) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (content === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.append(tag);
  }
  tag.content = content;
}

function setHead(
  selector: string,
  create: () => HTMLElement,
  attribute: string,
  value: string | null,
) {
  let tag = document.head.querySelector<HTMLElement>(selector);
  if (value === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = create();
    document.head.append(tag);
  }
  tag.setAttribute(attribute, value);
}

/** The public address chosen at build time (SITE_URL), or null when none was set. */
function siteOrigin(): string | null {
  return document.head.querySelector<HTMLMetaElement>('meta[name="site-origin"]')?.content || null;
}

/** Sets this page's own canonical link and og:url, only when the public address is known. */
function setAddress(path: string | null) {
  const origin = siteOrigin();
  const url = origin && path !== null ? `${origin}${path === '' ? '/' : path}` : null;
  setHead(
    'link[rel="canonical"]',
    () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
    'href',
    url,
  );
  setHead(
    'meta[property="og:url"]',
    () => {
      const tag = document.createElement('meta');
      tag.setAttribute('property', 'og:url');
      return tag;
    },
    'content',
    url,
  );
}

/**
 * Keeps the tab title and the search description in step with the page shown, for browsers,
 * search results and link previews. An unknown address is marked "noindex" so it is not listed.
 */
export function setPageMeta({
  title,
  description,
  notFound = false,
  path = '',
}: {
  title?: string;
  description?: string;
  notFound?: boolean;
  /** This page's address (for example "/lecture/gcd"); "" is the home page. */
  path?: string;
}) {
  document.title = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  setMeta('description', description ?? DEFAULT_DESCRIPTION);
  setMeta('robots', notFound ? 'noindex' : null);
  setAddress(notFound ? null : path);
}

/** Puts the head back to its defaults, for when another view takes over the page. */
export function resetPageMeta() {
  document.title = DEFAULT_TITLE;
  setMeta('description', DEFAULT_DESCRIPTION);
  setMeta('robots', null);
  setAddress(null);
}
