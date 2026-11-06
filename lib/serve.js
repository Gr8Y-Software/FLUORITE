'use strict';
// Tiny local static server for the built site (dist/), bound to 127.0.0.1 only.
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
    '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
};
// The site's service worker would cache pages and make the preview look stale, so serve one that removes itself.
const KILL_SW = "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.map(c=>caches.delete(c)))).then(()=>self.registration.unregister()))});";

function start(getRoot) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            try {
                const root = getRoot();
                const dist = root && path.join(root, 'dist');
                if (!dist) { res.writeHead(404); return res.end('No project open'); }
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p.startsWith('/__project_media__/')) {
                    const rel = p.slice('/__project_media__/'.length).replace(/\\/g, '/');
                    const mediaRoot = path.resolve(root);
                    const absMedia = path.resolve(mediaRoot, rel);
                    if (!absMedia.startsWith(mediaRoot + path.sep) || !fs.existsSync(absMedia) || !fs.statSync(absMedia).isFile()) {
                        res.writeHead(404); return res.end('Media not found');
                    }
                    res.writeHead(200, { 'content-type': MIME[path.extname(absMedia).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
                    return fs.createReadStream(absMedia).pipe(res);
                }
                if (p === '/sw.js') { res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' }); return res.end(KILL_SW); }
                if (p.endsWith('/')) p += 'index.html';
                let abs = path.join(dist, p);
                if (!abs.startsWith(dist + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
                if (!fs.existsSync(abs) && fs.existsSync(abs + '.html')) abs += '.html';
                // before the first build (or while editing CSS) assets are served from src/
                if (!fs.existsSync(abs)) for (const sub of ['assets', 'public']) {
                    const alt = sub === 'assets' ? path.join(root, 'src', p) : path.join(root, 'src', 'public', p);
                    if ((sub === 'public' || p.startsWith('/assets/')) && alt.startsWith(path.join(root, 'src') + path.sep) && fs.existsSync(alt) && fs.statSync(alt).isFile()) { abs = alt; break; }
                }
                if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
                    const nf = path.join(dist, '404.html');
                    res.writeHead(404, { 'content-type': MIME['.html'] });
                    return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : '<body style="font:16px system-ui;padding:40px">Nothing here yet. Build the site first.</body>');
                }
                res.writeHead(200, { 'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
                fs.createReadStream(abs).pipe(res);
            } catch (e) {
                res.writeHead(500); res.end(String(e));
            }
        });
        server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, server }));
    });
}

module.exports = { start };
