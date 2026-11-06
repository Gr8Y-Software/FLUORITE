'use strict';
// Pure Node project service: no Electron imports, so it can be tested with plain `node`.
//
// Two kinds of project are understood:
//   master  - has master.json; built by the Master SSG engine that lives in the project's build.js
//   legacy  - has build.js + data/site.json but no master.json (a hand-made site with its own build script).
//             Master SSG edits its data and Markdown and runs its build.js untouched.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const struct = require('./build/structure');

const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|mov|mkv)$/i;
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|svg|avif|ico|mp4|m4v|webm|ogv|mov|mkv)$/i;
const TEXT_EXT = /\.(html?|css|js|mjs|json|svg|txt|xml|md|webmanifest)$/i;
const MAX_TEXT = 1024 * 1024;
const RESERVED = ['site', 'page', 'content', 'root', 'data', 'year', 'this'];
const DEFAULT_CONFIG_MAPS = {
    'p.styles.json': {},
    'p.scripts.json': {},
};

function ensureProjectConfigMaps(dir) {
    const configs = path.join(dir, 'configs');
    fs.mkdirSync(configs, { recursive: true });
    for (const [name, value] of Object.entries(DEFAULT_CONFIG_MAPS)) {
        const file = path.join(configs, name);
        if (!fs.existsSync(file)) writeJsonAbs(file, value);
    }
}

function ensureStudioBuilder(dir) {
    const engine = path.join(__dirname, '..', 'core', 'scripts');
    for (const name of ['build.js', 'parser.js']) {
        const target = path.join(dir, name);
        if (!fs.existsSync(target)) fs.copyFileSync(path.join(engine, name), target);
    }
}

function inside(root, rel) {
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('Path is outside the project: ' + rel);
    return abs;
}
const posix = (p) => p.split(path.sep).join('/');
const readUtf8 = (f) => fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');

function kindOf(dir) {
    if (fs.existsSync(path.join(dir, 'master.json'))) return 'master';
    if (fs.existsSync(path.join(dir, 'build.js')) && fs.existsSync(path.join(dir, 'data', 'site.json'))) return 'legacy';
    if (['assets', 'data', 'configs', 'layouts'].every((name) => fs.existsSync(path.join(dir, name)) && fs.statSync(path.join(dir, name)).isDirectory())) return 'studio';
    return null;
}
const isProject = (dir) => !!kindOf(dir);

function walk(dir, base = dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
        if (name === '.git' || name === 'node_modules' || name === '.DS_Store') continue;
        const abs = path.join(dir, name);
        const st = fs.statSync(abs);
        if (st.isDirectory()) walk(abs, base, out);
        else out.push({ rel: posix(path.relative(base, abs)), size: st.size });
    }
    return out;
}

function walkDirectories(dir, base = dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
        if (name === '.git' || name === 'node_modules' || name === '.DS_Store') continue;
        const abs = path.join(dir, name);
        if (!fs.statSync(abs).isDirectory()) continue;
        out.push({ rel: posix(path.relative(base, abs)), isDirectory: true, size: 0 });
        walkDirectories(abs, base, out);
    }
    return out;
}

function listMedia(dir) {
    return walk(dir).filter((f) => MEDIA_EXT.test(f.rel) &&
        !/^\.git\//.test(f.rel) && !/^node_modules\//.test(f.rel) && !/^dist\//.test(f.rel)).map((f) => ({
        name: f.rel, size: f.size, type: VIDEO_EXT.test(f.rel) ? 'video' : 'image',
        url: pathToFileURL(path.join(dir, f.rel)).href,
    }));
}

// Editable text files under src/ (hand-written pages, partials, templates, layouts, css, js ...)
function listSources(dir) {
    return walk(path.join(dir, 'src'))
        .filter((f) => TEXT_EXT.test(f.rel) && f.size <= MAX_TEXT && !/^assets\/img\//.test(f.rel))
        .map((f) => ({ rel: 'src/' + f.rel, size: f.size }));
}

// Full editable project file index for the studio explorer. Keeps the project root
// implicit so the UI can render a single tree without exposing absolute paths.
function listProjectFiles(dir) {
    const files = walk(dir).filter((f) => f.size <= MAX_TEXT && TEXT_EXT.test(f.rel) &&
        !/^(?:dist|node_modules|src|assets\/(?:image|video|audio))(?:\/|$)/.test(f.rel));
    const dirs = walkDirectories(dir).filter((d) => !/^(?:dist|node_modules|src|assets\/(?:image|video|audio))(?:\/|$)/.test(d.rel));
    return [...dirs, ...files];
}

function builtPages(dir) {
    return walk(path.join(dir, 'dist')).filter((f) => /\.html$/i.test(f.rel)).map((f) => f.rel);
}

// Regions: {{region:name}} zones in templates, {{md:name}} includes, and the Markdown files that fill them
function scanRegions(dir) {
    const used = new Map();
    const includes = new Map();
    for (const f of listSources(dir)) {
        if (!/\.html?$/i.test(f.rel)) continue;
        let text;
        try { text = readUtf8(path.join(dir, f.rel)); } catch (e) { continue; }
        for (const m of text.matchAll(/\{\{\s*region:\s*([\w-]+)\s*\}\}/g)) {
            if (!used.has(m[1])) used.set(m[1], new Set());
            used.get(m[1]).add(f.rel);
        }
        for (const m of text.matchAll(/\{\{\s*md:\s*([\w./-]+)\s*\}\}/g)) {
            const n = m[1].replace(/\.md$/i, '');
            if (!includes.has(n)) includes.set(n, new Set());
            includes.get(n).add(f.rel);
        }
    }
    const regions = new Map();
    const get = (name) => {
        if (!regions.has(name)) regions.set(name, { name, usedIn: [...(used.get(name) || [])], global: null, collections: [], pages: [] });
        return regions.get(name);
    };
    for (const name of used.keys()) get(name);
    for (const f of walk(path.join(dir, 'data', 'regions'))) {
        if (!/\.md$/i.test(f.rel)) continue;
        const parts = f.rel.split('/');
        const name = parts.pop().replace(/\.md$/i, '');
        const file = 'data/regions/' + f.rel;
        const r = get(name);
        if (!parts.length) r.global = file;
        else if (parts.length === 1 && parts[0].startsWith('@')) r.collections.push({ collection: parts[0].slice(1), file });
        else r.pages.push({ slug: parts.join('/'), file });
    }
    const incl = [...includes.entries()].map(([name, files]) => {
        const file = 'data/md/' + name + '.md';
        return { name, file, exists: fs.existsSync(path.join(dir, file)), usedIn: [...files] };
    });
    return {
        regions: [...regions.values()].sort((a, b) => a.name.localeCompare(b.name)),
        includes: incl.sort((a, b) => a.name.localeCompare(b.name)),
    };
}

function sha(file) { try { return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex'); } catch (e) { return ''; } }

function engineStatus(dir, starterDir) {
    if (kindOf(dir) !== 'master') return 'own';
    const a = sha(path.join(dir, 'build.js')), b = sha(path.join(starterDir, 'build.js'));
    return a && a === b ? 'current' : 'outdated';
}

function scan(dir, starterDir) {
    return { media: listMedia(dir), sources: listSources(dir), projectFiles: listProjectFiles(dir), built: builtPages(dir), engine: engineStatus(dir, starterDir), ...scanRegions(dir) };
}

function loadProject(dir, starterDir) {
    const kind = kindOf(dir);
    if (!kind) throw new Error('This folder is not a Master SSG project (it needs a master.json, or a build.js and data/site.json).');
    ensureProjectConfigMaps(dir);
    if (kind === 'studio') ensureStudioBuilder(dir);
    const files = {};
    const errors = {};
    const dataDir = path.join(dir, 'data');
    for (const f of fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((n) => n.toLowerCase().endsWith('.json')).sort() : []) {
        try { files[f] = JSON.parse(readUtf8(path.join(dataDir, f))); } catch (e) { errors[f] = e.message; }
    }
    let config = null;
    if (kind === 'master') {
        try {
            config = JSON.parse(readUtf8(path.join(dir, 'master.json')));
            if (!Array.isArray(config.collections)) config.collections = [];
        } catch (e) { errors['master.json'] = e.message; config = { engine: 1, collections: [] }; }
        // a declared collection whose data file does not exist yet starts empty (it is written on first save)
        for (const c of config.collections) {
            const f = c.file || (c.name + '.json');
            if (!files[f] && !errors[f]) files[f] = { [c.key || 'items']: [] };
        }
    }
    try { files['site.json'] = JSON.parse(readUtf8(path.join(dir, 'site.json'))); } catch (e) { if (fs.existsSync(path.join(dir, 'site.json'))) errors['site.json'] = e.message; }
    const site = files['site.json'] || {};
    return { dir, kind, config, name: site.name || path.basename(dir), files, errors, ...scan(dir, starterDir) };
}

function eolOf(abs, fallback) {
    return fs.existsSync(abs) ? (/\r\n/.test(fs.readFileSync(abs, 'utf8')) ? '\r\n' : '\n') : fallback;
}
function writeJsonAbs(abs, obj) {
    const eol = eolOf(abs, process.platform === 'win32' ? '\r\n' : '\n'); // keep the file's own line endings
    const text = JSON.stringify(obj, null, 2).replace(/\n/g, eol) + eol;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = abs + '.tmp';
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, abs);
}
function writeJson(dir, file, obj) {
    if (path.basename(file) !== file || !file.toLowerCase().endsWith('.json')) throw new Error('Invalid data file name.');
    writeJsonAbs(path.join(dir, file === 'site.json' ? '' : 'data', file), obj);
}
function writeMaster(dir, obj) { writeJsonAbs(path.join(dir, 'master.json'), obj); }

// Markdown files (data/**.md)
function mdAbs(dir, rel) {
    const dataDir = path.join(dir, 'data');
    const abs = inside(dir, rel);
    if (!abs.startsWith(dataDir + path.sep) || !abs.toLowerCase().endsWith('.md')) throw new Error('Markdown files must live in data/: ' + rel);
    return abs;
}
const readMd = (dir, rel) => { const abs = mdAbs(dir, rel); return fs.existsSync(abs) ? readUtf8(abs) : ''; };
function writeMd(dir, rel, text) {
    const abs = mdAbs(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text, 'utf8');
}

// Source text files (src/**, master.json)
function textAbs(dir, rel) {
    const abs = inside(dir, String(rel).replace(/\\/g, '/'));
    const top = posix(path.relative(dir, abs));
    if (!top || top.startsWith('dist/') || top.startsWith('node_modules/')) throw new Error('This project file cannot be edited here: ' + rel);
    if (!TEXT_EXT.test(top)) throw new Error('Not a text file type: ' + rel);
    return abs;
}
function readText(dir, rel) {
    const abs = textAbs(dir, rel);
    if (!fs.existsSync(abs)) throw new Error('File not found: ' + rel);
    if (fs.statSync(abs).size > MAX_TEXT) throw new Error('File is too large to edit here: ' + rel);
    return readUtf8(abs);
}
function writeText(dir, rel, text) {
    const abs = textAbs(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text, 'utf8');
}
function createText(dir, rel, text) {
    if (fs.existsSync(textAbs(dir, rel))) throw new Error('That file already exists: ' + rel);
    writeText(dir, rel, text);
}
function ensureProjectPath(dir, rel) {
    const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!clean || clean.split('/').some((part) => !/^[\p{L}\p{N}_-]+$/u.test(part))) throw new Error('Invalid folder path.');
    const abs = inside(dir, clean);
    if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
    else if (!fs.statSync(abs).isDirectory()) throw new Error('A file already exists at that path.');
    return posix(clean);
}
function createPageBundle(dir, name, subpath = '') {
    const slug = String(name || '').trim();
    const sub = String(subpath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const valid = (s) => !s || s.split('/').every((p) => /^[\p{L}\p{N}_-]+$/u.test(p));
    if (!/^[\p{L}\p{N}_-]+$/u.test(slug) || !valid(sub)) throw new Error('Use letters, numbers, dashes or underscores in the page path.');
    const base = sub ? `${sub}/` : '';
    const page = { name: `${base}${slug}`, layout: `layouts/${base}${slug}.html`, content: `data/${base}${slug}.md`, config: `configs/${base}p.${slug}.json`, output: `${base}${slug}.html` };
    const files = [
        { rel: page.layout, text: `<!doctype html>\n<html lang="{{site.lang}}" dir="{{site.dir}}">\n<head>\n  <meta charset="utf-8">\n  <title>{{page.title}}</title>\n</head>\n<body>\n<md></md>\n</body>\n</html>\n` },
        { rel: page.content, text: '' },
        { rel: page.config, text: JSON.stringify({ page: page.name, path: page.output }, null, 2) + '\n' },
    ];
    const existingPages = struct.pageDescriptors(dir);
    if (existingPages.some((item) => item.name === page.name || item.output === page.output)) throw new Error(`A page named "${page.name}" or output path "${page.output}" is already registered.`);
    for (const file of files) if (fs.existsSync(textAbs(dir, file.rel))) throw new Error(`A file named ${file.rel} already exists.`);
    for (const file of files) writeText(dir, file.rel, file.text);
    struct.update(dir);
    return files.map((f) => f.rel);
}
function createPageFiles(dir, name, includeMarkdown = false) {
    const slug = String(name || '').trim();
    if (!/^[\p{L}\p{N}_-]+$/u.test(slug)) throw new Error('Use letters, numbers, dashes or underscores for the page name.');
    const page = { name: slug, layout: `layouts/${slug}.html`, content: `data/${slug}.md`, config: `configs/p.${slug}.json`, output: `${slug}.html` };
    const files = [
        { rel: page.layout, text: `<!doctype html>\n<html lang="{{site.lang}}" dir="{{site.dir}}">\n<head>\n  <meta charset="utf-8">\n  <title>{{page.title}}</title>\n</head>\n<body>\n<md></md>\n</body>\n</html>\n` },
        { rel: page.content, text: '' },
        { rel: page.config, text: JSON.stringify({ page: slug, path: page.output }, null, 2) + '\n' },
    ];
    const existingPages = struct.pageDescriptors(dir);
    if (existingPages.some((item) => item.name === slug || item.output === page.output)) throw new Error(`A page named "${slug}" or output path "${page.output}" is already registered.`);
    for (const file of files) if (fs.existsSync(textAbs(dir, file.rel))) throw new Error(`A file named ${file.rel} already exists.`);
    for (const file of files) writeText(dir, file.rel, file.text);
    struct.update(dir);
    return files.map((f) => f.rel);
}
function renameFile(dir, from, to) {
    const a = textAbs(dir, from), b = textAbs(dir, to);
    if (!fs.existsSync(a)) throw new Error('File not found: ' + from);
    if (fs.existsSync(b)) throw new Error('That name is already taken: ' + to);
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.renameSync(a, b);
}

function importMedia(dir, source, destination = 'src/assets/img') {
    const root = path.resolve(dir);
    const sourceAbs = path.resolve(source);
    if (!fs.existsSync(sourceAbs) || !fs.statSync(sourceAbs).isFile() || !MEDIA_EXT.test(sourceAbs)) {
        throw new Error('Choose an image or video file.');
    }
    const destDir = inside(root, String(destination || '').replace(/\\/g, '/'));
    fs.mkdirSync(destDir, { recursive: true });
    const ext = path.extname(sourceAbs);
    const stem = path.basename(sourceAbs, ext);
    let fileName = stem + ext;
    for (let i = 2; fs.existsSync(path.join(destDir, fileName)); i++) fileName = `${stem}-${i}${ext}`;
    const target = path.join(destDir, fileName);
    try {
        fs.renameSync(sourceAbs, target);
    } catch (err) {
        if (err.code !== 'EXDEV') throw err;
        fs.copyFileSync(sourceAbs, target);
        fs.unlinkSync(sourceAbs);
    }
    return posix(path.relative(root, target));
}
function mediaAbs(dir, name) {
    const abs = inside(dir, name);
    if (!MEDIA_EXT.test(abs)) throw new Error('Not a media file: ' + name);
    return abs;
}

function build(dir) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const output = [];
        const capture = (data) => {
            for (const line of String(data).split(/\r?\n/).filter(Boolean)) output.push(line);
            if (output.length > 40) output.splice(0, output.length - 40);
        };
        // ELECTRON_RUN_AS_NODE makes the Electron binary behave as plain Node, so no separate Node install is needed.
        const p = spawn(process.execPath, ['build.js'], {
            cwd: dir,
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            windowsHide: true,
        });
        p.stdout.on('data', capture);
        p.stderr.on('data', capture);
        p.on('error', (e) => resolve({ code: -1, ms: Date.now() - t0, message: e.message }));
        p.on('close', (code) => {
            const details = output.slice(-40).join('\n').slice(-5000);
            resolve({ code, ms: Date.now() - t0, message: code === 0 ? '' : details.slice(-1200), output: details });
        });
    });
}

// Markdown preview: uses the project's own parser.js so the preview matches the build
let parserCache = { file: '', mtime: 0, fn: null };
function renderMarkdown(dir, md) {
    const file = path.join(dir, 'parser.js');
    const mtime = fs.statSync(file).mtimeMs;
    if (parserCache.file !== file || parserCache.mtime !== mtime) {
        delete require.cache[require.resolve(file)];
        parserCache = { file, mtime, fn: require(file) };
    }
    let site = {};
    try { site = JSON.parse(readUtf8(path.join(dir, 'site.json'))); } catch (e) { try { site = JSON.parse(readUtf8(path.join(dir, 'data', 'site.json'))); } catch (e2) { /* preview still works */ } }
    let opts;
    if (kindOf(dir) === 'master') {
        let cfg = {};
        try { cfg = JSON.parse(readUtf8(path.join(dir, 'master.json'))).markdown || {}; } catch (e) { /* defaults */ }
        opts = Object.assign({ externalLinks: true, sanitize: true }, cfg, { dir: site.dir === 'rtl' ? 'auto' : '' });
    }
    const flat = {};
    (function walkObj(o, pre) {
        for (const [k, v] of Object.entries(o)) {
            const key = pre ? pre + '.' + k : k;
            if (v && typeof v === 'object' && !Array.isArray(v)) walkObj(v, key);
            else if (!Array.isArray(v)) flat[key] = String(v);
        }
    })(site, 'site');
    const filled = String(md).replace(/\{\{\s*(site\.[\w.]+)\s*\}\}/g, (m, k) => (k in flat ? flat[k] : m));
    return parserCache.fn(filled, opts);
}

// ---- creating things
function folderName(name) {
    return String(name).trim().replace(/[<>:"/\\|?*\x00-\x1f]+/g, '').replace(/\s+/g, '-').replace(/^\.+/, '') || 'my-site';
}

function createProject(parentDir, name, starterDir, opts = {}) {
    const target = path.join(parentDir, folderName(name));
    if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error('That folder already exists and is not empty: ' + target);
    fs.mkdirSync(target, { recursive: true });
    for (const folder of ['assets/image', 'assets/video', 'assets/audio', 'data', 'configs', 'layouts', 'scripts', 'styles', 'structures', 'textes']) fs.mkdirSync(path.join(target, folder), { recursive: true });
    ensureProjectConfigMaps(target);
    ensureStudioBuilder(target);
    const site = {
        url: '', logo: '', icon_512: '', icon_192: '', og_image: '',
        lang: '', dir: '', theme_color: '', name: String(name).trim() || folderName(name),
        short_name: '', tagline: '', description: '',
    };
    if (opts.lang) site.lang = opts.lang;
    if (opts.dir) site.dir = opts.dir;
    writeJsonAbs(path.join(target, 'site.json'), site);
    createPageBundle(target, 'index');
    return target;
}

function updateEngine(dir, starterDir) {
    if (kindOf(dir) !== 'master') throw new Error('Only projects with a master.json use the Master SSG engine.');
    for (const f of ['build.js', 'parser.js']) {
        const dst = path.join(dir, f);
        if (fs.existsSync(dst) && sha(dst) !== sha(path.join(starterDir, f))) fs.copyFileSync(dst, dst + '.bak');
        fs.copyFileSync(path.join(starterDir, f), dst);
    }
}

function readStructure(dir) {
    struct.update(dir);
    return fs.readFileSync(path.join(dir, 'site.xml'), 'utf8');
}

const COLLECTION_TEMPLATE = `---
nav: {{page.collection}}
---
{{> page-banner title=page.title subtitle=page.summary kicker=page.category}}

<section class="prose">
    <div class="narrow">
{{#if page.date}}        <p style="color:var(--text-soft);margin-top:0">{{page.date | date}}</p>
{{/if}}{{#if page.image}}        <img class="cover" src="{{page.image | img}}" alt="">
{{/if}}{{page.body}}
    </div>
</section>
`;
const collectionList = (name, label) => `---
title: ${label}
description: ${label}
nav: ${name}
---
{{> page-banner title=page.title subtitle=page.subtitle}}

<section class="section">
    <div class="container">
        <div class="grid">
{{#each ${name}}}{{> card-${name}}}
{{else}}            <div class="empty">Nothing here yet.</div>
{{/each}}        </div>
    </div>
</section>
`;
const COLLECTION_CARD = `<a class="card" href="{{root}}{{url}}">
{{#if image}}    <img class="thumb" src="{{image | img}}" alt="" loading="lazy">
{{else}}    <div class="thumb empty-thumb"></div>
{{/if}}    <div class="body">
        <div class="kicker">{{category}}</div>
        <h3>{{title}}</h3>
        <p>{{excerpt | truncate:140}}</p>
        <span class="more">Open →</span>
    </div>
</a>
`;

// A new kind of content: its data file, a detail template, a list page and a card, all registered in master.json.
function addCollection(dir, spec) {
    if (kindOf(dir) !== 'master') throw new Error('Collections are declared in master.json. This project has its own build script.');
    const name = String(spec.name || '').trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error('The name must start with a letter and use only letters, digits and underscores (templates use it: {{#each name}}).');
    if (RESERVED.includes(name)) throw new Error(`"${name}" is reserved. Choose another name.`);
    const cfg = JSON.parse(readUtf8(path.join(dir, 'master.json')));
    cfg.collections = cfg.collections || [];
    if (cfg.collections.some((c) => c.name === name)) throw new Error(`A collection named "${name}" already exists.`);
    if (fs.existsSync(path.join(dir, 'data', name + '.json'))) throw new Error(`data/${name}.json already exists.`);
    const label = String(spec.label || name).trim();
    const withPages = spec.pages !== false;
    const entry = { name, label, file: name + '.json' };
    if (withPages) { entry.template = name; entry.url = spec.url || `${name}/{slug}.html`; }
    entry.sort = 'date'; entry.order = 'desc';
    entry.fields = [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'date', type: 'date', label: 'Date' },
        { name: 'category', type: 'text', label: 'Category' },
        { name: 'summary', type: 'textarea', label: 'Summary' },
        { name: 'image', type: 'image', label: 'Image' },
        { name: 'draft', type: 'bool', label: 'Draft' },
    ];
    writeJsonAbs(path.join(dir, 'data', name + '.json'), { items: [] });
    const made = ['data/' + name + '.json'];
    const put = (rel, text) => {
        const abs = path.join(dir, rel);
        if (fs.existsSync(abs)) return;
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
        made.push(rel);
    };
    if (withPages) {
        put('src/templates/' + name + '.html', COLLECTION_TEMPLATE);
        put('src/partials/card-' + name + '.html', COLLECTION_CARD);
        if (spec.listPage !== false) put('src/pages/' + name + '.html', collectionList(name, label));
    }
    cfg.collections.push(entry);
    writeMaster(dir, cfg);
    return made;
}

function newHtmlPage(dir, spec) {
    const slug = String(spec.slug || '').trim().replace(/\.html$/i, '');
    if (!slug || /(^|\/)\.\.(\/|$)|^\/|\\/.test(slug)) throw new Error('Invalid page path.');
    const rel = `src/pages/${slug}.html`;
    const key = slug.split('/').pop();
    createText(dir, rel, `---
title: ${String(spec.title || slug).trim()}
description:
nav: ${key}
---
{{> page-banner title=page.title subtitle=page.subtitle}}

<section class="section">
    <div class="narrow">
{{region:${key}-content}}
    </div>
</section>
`);
    return rel;
}

module.exports = {
    isProject, kindOf, loadProject, scan, writeJson, writeMaster, readMd, writeMd, mdAbs, readText, writeText, createText, ensureProjectPath, createPageFiles, createPageBundle, renameFile, textAbs, mediaAbs,
    importMedia, listMedia, build, renderMarkdown, createProject, updateEngine, readStructure, addCollection, newHtmlPage, scanRegions, inside, engineStatus,
};
