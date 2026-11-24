import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

// Publish only the browser application; tests and local dependencies stay private to the checkout.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const entry of ['index.html', 'css', 'js']) {
  await cp(entry, `dist/${entry}`, { recursive: true });
}
await writeFile('dist/.nojekyll', '');
console.log('Static site built in dist/');
