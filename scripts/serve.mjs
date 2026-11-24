import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const directory = resolve(process.argv[2] || '.');
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.avif': 'image/avif' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end();
    return;
  }
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Also preview the GitHub project-site path to catch broken absolute asset URLs.
    if (pathname.startsWith('/castle_rush/')) pathname = pathname.slice('/castle_rush'.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(directory, `.${pathname}`);
    if (!file.startsWith(directory + sep)) {
      response.writeHead(403).end();
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
