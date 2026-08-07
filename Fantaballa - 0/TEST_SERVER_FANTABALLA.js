const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2]) || 8765;
const root = path.resolve(__dirname);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let rel = rawPath.replace(/^\/+/, '');
    if (!rel) rel = 'index.html';

    const filePath = path.resolve(root, rel);
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      return send(res, 403, '403 Forbidden');
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) return send(res, 404, '404 Not Found');

      const type = mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': stat.size,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (err) {
    send(res, 500, '500 Server Error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log('');
  console.log('==============================================');
  console.log(' FANTABALLA - SERVER DI TEST');
  console.log('==============================================');
  console.log(` http://127.0.0.1:${port}/`);
  console.log('');
  console.log('Chiudi questa finestra per fermare il server.');
  console.log('');
});

server.on('error', err => {
  console.error('Impossibile avviare il server:', err.message);
  console.error(`Controlla che la porta ${port} non sia gia in uso.`);
  process.exitCode = 1;
});
