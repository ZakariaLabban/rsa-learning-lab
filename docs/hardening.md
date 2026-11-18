# Hardening: errors, accessibility, performance and sharing (#21)

## Error page and 404

- `app/ErrorBoundary.tsx` wraps every experience. If a page cannot be drawn, or a page file does not
  load (often right after an update), the visitor sees a clear message with **Reload the page** and
  **Go to the start**, and a closed "Technical details" box. Nothing is sent anywhere; the details stay
  on screen and in the browser console. Moving to another address tries again.
- Unknown `/lecture/...` addresses show a 404 page ("Back to the course map", "Start with lesson 1") and
  are marked `noindex`. The animated workshop and the Legacy lab already had their own 404 messages.
  This is a "soft 404": the server still answers 200 (every address returns the app), and the page
  marks itself `noindex` in the browser. That is normal for a single-page app.
- Leaving a page leaves nothing behind: when another view takes over, the title, description,
  `noindex` and canonical tags go back to their defaults.

## Page titles, descriptions and sharing

- The lesson list (`features/lecture/lessons.ts`) is plain data. Each lesson sets the tab title and the
  search description from it (`features/lecture/pageMeta.ts`).
- `index.html` has the default title and description, icons (`public/favicon.svg`,
  `public/apple-touch-icon.png`), and link-preview tags (`og:*`, `twitter:card`) with
  `public/og-image.png` (1200 x 630). Regenerate the two PNGs with
  `node scripts/make-share-images.mjs` if the name or look changes.
- `robots.txt` is written at build time. An absolute preview-image URL, `sitemap.xml` and each page's
  own canonical link and `og:url` need the public address, which is not chosen yet (#41). Build with it
  set when the domain is known:

  ```bash
  SITE_URL=https://your-domain.example npm run build
  ```

  The build puts the address in a `site-origin` tag; each page then sets its own canonical link and
  `og:url` in the browser (a single static canonical would point every page at the home page). A bad
  `SITE_URL` stops the build with a clear message.
  Without `SITE_URL` nothing is invented: no canonical link or `og:url`, a relative preview image, and
  no sitemap.

## Accessibility

Automated checks run in CI with the other browser tests:

- `browser-tests/accessibility.spec.ts` runs axe (WCAG 2.0/2.1 A and AA) on the home page, all 16
  lessons, opened sections, finished tables, practice results, the Messages result, the 404 page and the
  error page, in light and dark themes, plus five pages at 375 px.
- The same file checks keyboard use: the skip link is the first tab stop and jumps to the lesson, a
  lesson can be stepped through with Enter and Space, controls show a focus outline of at least 2 px,
  and reduced motion turns the animations off.
- Tabs follow the arrow-key pattern (arrows, Home, End) with labelled panels.
- The step highlight never lowers text opacity (a colour flash only), so text stays readable while it
  animates; links inside sentences are underlined.

### Known gaps in the old views

The animated workshop (`/playground`) and the Legacy lab (`/legacy`) were built with very small, low
contrast text and are planned to be retired (#45). They are not part of the enforced axe tests. A scan
found, in both:

- Contrast: `.subtle-badge`, `.segmented` buttons, `.key-status`, `.amber-badge`, `.secret-placeholder`,
  `.lesson-output-register` and a few small labels (many are 5 to 8 px text with ratios of 1 to 3.7).
- `label-content-name-mismatch`: the five workshop station buttons (`aria-label` does not include the
  visible text). Their labels are used by the workshop tests.

The brand link and the ".pub" export button labels were fixed. Fixing the rest properly means redesigning
those views, which #45 makes unnecessary if they are retired.

## Performance

Lighthouse, mobile emulation (default throttling), against `vite preview` of the production build:

| Page                | Performance | Accessibility | Best practices | SEO |
| ------------------- | ----------- | ------------- | -------------- | --- |
| `/` (landing)       | 98          | 100           | 100            | 100 |
| `/lecture/messages` | 98          | 100           | 100            | 100 |
| `/legacy`           | 95          | 95            | 100            | 100 |

On the landing page: first contentful paint 0.9 s, largest contentful paint 2.3 s, total blocking time
0 ms, layout shift 0. Reproduce with:

```bash
npm run build && npm run preview          # serves http://127.0.0.1:4173
npx lighthouse http://127.0.0.1:4173/ --only-categories=performance,accessibility,best-practices,seo
```

Numbers vary by machine; treat them as a check against regressions, not a guarantee. Routes are already
split into lazy chunks, and the 2048-bit key work runs in a worker.
