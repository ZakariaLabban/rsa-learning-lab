// Old bookmarks stay useful; the backup interfaces are not publicly mounted.
const destinations: Record<string, string> = {
  '/legacy': '/',
  '/playground': '/',
  '/playground/legacy': '/',
  '/learn/keys': 'keys',
  '/learn/euclid': 'inverse',
  '/learn/miller-rabin': 'primality',
  '/learn/square-and-multiply': 'power',
  '/learn/encrypt': 'messages',
  '/learn/crt': 'crt',
  '/learn/signatures': 'signatures',
  '/learn/why-rsa-works': 'why',
  '/learn/example': 'rsa',
  '/learn/practice': 'practice',
  '/contacts': 'contacts',
  '/files': 'messages',
  '/experiments': 'practice',
  '/break/factoring': 'factoring',
  '/break/yes-or-no': 'guessing',
  '/break/small-e': 'small-e',
};
export function lectureRedirect(pathname: string): string | null {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const destination = destinations[path] ?? destinations[path.replace(/^\/playground/, '')];
  if (destination) return destination === '/' ? '/' : `/lecture/${destination}`;
  if (/^\/(playground|legacy|learn|break)(\/|$)/.test(path)) return '/';
  return null;
}
