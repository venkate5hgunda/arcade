import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [],
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        fileURLToPath(new URL('../docs/redesign', import.meta.url)),
      ],
    },
  },
  preview: { port: 5174, strictPort: true },
  build: { outDir: 'node_modules/.cache/redesign-dist', emptyOutDir: true },
});
