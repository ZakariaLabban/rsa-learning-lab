# Frontend structure during migration

- `app/`: URL routes, shell, theme, orientation and temporary API session state.
- `components/`: reusable display, teaching, error and playback controls.
- `content/glossary.ts`: term definitions and chapter references.
- `features/home/`: landing page and explicitly planned-feature pages.
- `features/legacy/`: preserved key studio, message journey, math explorer and
  experiments, separated from the old monolithic App.
- `engine/math/`: independent BigInt algorithms and bounded optional traces.
- `styles/`: readable preserved workspace styles, shared tokens and shell styles.

`app/routes.ts` defines Learn, Break and Tools routes. BrowserRouter supports deep
links, refresh and back/forward. Vite preview handles static fallback; the existing
Python frontend server also serves these paths without capturing missing `/api`
routes. Hosted rewrite configuration is #9. The app runs key generation and message operations in browser workers;
the shell, worked example, key studio and existing experiments need no backend. Workbench stays mounted when navigating so message
and playback state are preserved. No Python files or launchers are retired here.

Shared controls:

| Component | Contract |
| --- | --- |
| `NumberView` | `label`, BigInt `value`, optional `privateValue`; dec/hex/base64, copy/expand and explicit private reveal |
| `Stepper` | Controlled `step`, `count`, `onChange`; previous/next/play/speed/result; reduced motion uses manual steps |
| `RolePanels` | Array of Alice/Bob/Eve, knowledge and optional action descriptions |
| `Term` | Glossary key; tooltip visible on pointer hover and keyboard focus |
| `ErrorBanner` | Message and optional dismiss callback |
| `LectureExampleButton` | Caller-owned `onLoad` and optional label; no baked-in numbers |

Theme preference uses localStorage when available and falls back to memory if
storage is blocked. The full offline app cache is #50; loading a static shell
without Python does not itself mean it can reopen without a network connection.
The browser tests cover all routes with API requests disabled, both themes at
375/1440px, navigation, focus restoration, theme persistence and the worked example.

The test runner uses bundled Chromium by default. To use an installed Edge on
Windows, set `$env:RSA_BROWSER_CHANNEL='msedge'` before `npm run test:browser`.
