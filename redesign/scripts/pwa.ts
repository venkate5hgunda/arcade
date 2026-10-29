import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export function buildOfflineAssets(directory: string, worker: string) {
  const files: string[] = [];
  function visit(relative: string) {
    for (const entry of readdirSync(join(directory, relative), {
      withFileTypes: true,
    })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(path);
      else if (
        entry.isFile() &&
        !['arcade-sw.js', 'offline-assets.json', '.DS_Store'].includes(
          entry.name,
        ) &&
        !path.endsWith('.map')
      )
        files.push(path);
    }
  }
  visit('');
  files.sort();
  const assets = files.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(join(directory, path)))
      .digest('hex'),
  }));
  const version = createHash('sha256')
    .update(worker)
    .update(JSON.stringify(assets))
    .digest('hex')
    .slice(0, 24);
  const graph = { version, assets };
  const manifest = JSON.stringify(graph);
  writeFileSync(join(directory, 'offline-assets.json'), manifest);
  const all = {
    version,
    assets: [
      ...assets,
      {
        path: 'offline-assets.json',
        sha256: createHash('sha256').update(manifest).digest('hex'),
      },
    ],
  };
  writeFileSync(
    join(directory, 'arcade-sw.js'),
    worker.replace('__ARCADE_BUILD__', JSON.stringify(all)),
  );
  return graph;
}
