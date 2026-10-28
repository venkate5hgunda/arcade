import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  createReadStream,
} from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const movieRoot = fileURLToPath(new URL('../data/movies/', import.meta.url));
function movieAssets(): Plugin {
  return {
    name: 'arcade-approved-movies',
    configureServer(server) {
      server.middlewares.use('/data/movies', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!(name === 'index.json' || /^[\w.-]+\.jsonl$/.test(name)))
          return next();
        const file = join(movieRoot, name);
        const stream = createReadStream(file);
        stream.on('error', next);
        res.setHeader(
          'Content-Type',
          name.endsWith('.json') ? 'application/json' : 'application/x-ndjson',
        );
        stream.pipe(res);
      });
    },
    writeBundle(options) {
      if (!options.dir)
        throw new Error('Movie assets require a build output directory.');
      const target = join(options.dir, 'data', 'movies');
      mkdirSync(target, { recursive: true });
      const index = JSON.parse(
        readFileSync(join(movieRoot, 'index.json'), 'utf8'),
      ) as { files: { path: string }[] };
      copyFileSync(join(movieRoot, 'index.json'), join(target, 'index.json'));
      for (const file of index.files) {
        if (!/^[\w.-]+\.jsonl$/.test(file.path))
          throw new Error('Invalid movie partition path.');
        copyFileSync(join(movieRoot, file.path), join(target, file.path));
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [movieAssets()],
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
