'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const GUI_ROOT = path.resolve(__dirname, '..', 'gui');
const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8',
};

function start() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let pathname;
            try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
            catch { res.writeHead(400); return res.end('Bad request'); }
            if (pathname === '/') pathname = '/index.html';
            const abs = path.resolve(GUI_ROOT, `.${pathname}`);
            if (!abs.startsWith(GUI_ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
            if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); return res.end(); }
            if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { res.writeHead(404); return res.end('Not found'); }
            res.writeHead(200, { 'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
            if (req.method === 'HEAD') return res.end();
            fs.createReadStream(abs).pipe(res);
        });
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, server }));
    });
}

module.exports = { start };
