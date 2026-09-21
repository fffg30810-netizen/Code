// Server statico minimo per dist/ (usato dagli screenshot e per provare il viewer in locale).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.css': 'text/css' };
export function startServer(dir, port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      let file = path.join(dir, decodeURIComponent(url.pathname));
      if (url.pathname === '/' || url.pathname === '') file = path.join(dir, 'index.html');
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const { port } = await startServer(dir, +(process.env.PORT || 8080));
  console.log(`Artù 3D: http://127.0.0.1:${port}/`);
}
