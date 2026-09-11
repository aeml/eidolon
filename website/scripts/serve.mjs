import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = process.argv.includes('--dist') ? '../dist/' : '../src/';
const root = fileURLToPath(new URL(directory, import.meta.url));
const port = Number(process.env.PORT || 4321);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const sharedModule = pathname === '/GoogleAnalytics.js' && !process.argv.includes('--dist');
    const file = sharedModule ? fileURLToPath(new URL('../../src/analytics/GoogleAnalytics.js', import.meta.url)) : resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if ((!sharedModule && !file.startsWith(resolve(root) + sep)) || !(await stat(file)).isFile()) throw new Error('Not found');
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(resolve(root, '404.html')));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Eidolon website: http://127.0.0.1:${port}`));
