import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { precacheList } from './src/offline/swPolicy';

/**
 * Builds the offline service worker (#50) to a stable `/sw.js` and injects this
 * build's exact file list and a content version, so each deploy gets its own cache.
 */
function offlineServiceWorker(): Plugin {
  return {
    name: 'rsa-lab-offline-service-worker',
    apply: 'build',
    // Run after Vite's HTML plugin has emitted index.html into the bundle.
    enforce: 'post',
    generateBundle(_options, bundle) {
      const worker = bundle['sw.js'];
      if (!worker || worker.type !== 'chunk') throw new Error('sw.js was not built.');
      // register('/sw.js') loads a classic script: it must not import shared chunks.
      if (worker.imports.length || worker.dynamicImports.length || worker.exports.length)
        throw new Error('sw.js must be a standalone script; do not share modules with the app.');
      const files = precacheList(Object.keys(bundle));
      const hash = createHash('sha256');
      // The worker's own logic is part of the version, as well as every cached file.
      hash.update(worker.code);
      for (const file of files) {
        const output = bundle[file.slice(1)];
        hash.update(file);
        hash.update(output.type === 'chunk' ? output.code : output.source);
      }
      const version = hash.digest('hex').slice(0, 16);
      // sw.ts reads these as bare global identifiers, which minification leaves intact.
      const inject = (code: string, name: string, value: unknown) => {
        const parts = code.split(name);
        if (parts.length !== 2) throw new Error(`sw.js must use ${name} exactly once.`);
        return parts.join(JSON.stringify(value));
      };
      worker.code = inject(
        inject(worker.code, '__RSA_LAB_PRECACHE__', files),
        '__RSA_LAB_VERSION__',
        version,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  server: { proxy: { '/api': 'http://127.0.0.1:8765' } },
  build: {
    rollupOptions: {
      input: { main: 'index.html', sw: 'src/sw.ts' },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
