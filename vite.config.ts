/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Makes the production build openable straight from the filesystem (dist/index.html via file://).
 *
 * Browsers refuse `<script type="module">` and `crossorigin` stylesheets from a file:// origin (it counts as
 * "null", so the request fails CORS) and the page stays blank. The build below emits one classic script, and this
 * plugin removes `type="module"` and `crossorigin` from the generated tags and defers the script so it still runs
 * after the page is parsed. Development (`npm run dev`) is unaffected: this only applies to `vite build`.
 */
function portableStaticBuild(): Plugin {
  return {
    name: 'portable-static-build',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/<script type="module" crossorigin /g, '<script defer ')
          .replace(/(<link rel="stylesheet") crossorigin /g, '$1 '),
    },
  };
}

// Hash routing and a relative base let the static build run from any folder, with no server and no route fallback.
export default defineConfig({
  base: './',
  plugins: [react(), portableStaticBuild()],
  build: {
    rolldownOptions: {
      // One self-contained classic script (no ES-module imports, no chunks), so it loads from file://.
      output: { format: 'iife', codeSplitting: false },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['node_modules', 'dist', 'src/reference/**'],
  },
});
