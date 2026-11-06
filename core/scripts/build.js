'use strict';
// Dependency-free static site builder. Run with: node build.js [project-directory]
const fs = require('fs');
const path = require('path');
const markdownToHTML = require('./parser');

const safeRel = (value, label) => {
    const rel = String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!rel || /^[a-z]:/i.test(rel) || rel.split('/').some((p) => !p || p === '.' || p === '..')) throw new Error(`Unsafe ${label} path: ${value}`);
    return rel;
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map((m) => [m[1], m[3].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')]));
function splitMarkdown(text) {
    return String(text).replace(/\r\n?/g, '\n').split(/^\s*---\s*$/m);
}
function dotted(obj, key) { return String(key).split('.').reduce((value, part) => value == null ? undefined : value[part], obj); }
function interpolate(html, site, page) {
    return html.replace(/\{\{\s*(site|page)\.([\w.-]+)\s*\}\}/g, (_, scope, key) => {
        const value = dotted(scope === 'site' ? site : page, key);
        return value == null || typeof value === 'object' ? '' : String(value);
    });
}
const xmlEscape = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
function plainText(html) {
    return String(html).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
}
function copyEntry(root, dist, entry) {
    const source = safeRel(entry.source, 'source');
    const output = safeRel(entry.output || source, 'output');
    const src = path.resolve(root, source), dst = path.resolve(dist, output);
    if (!src.startsWith(root + path.sep)) throw new Error(`Source escapes the project: ${source}`);
    if (!dst.startsWith(dist + path.sep)) throw new Error(`Output escapes dist/: ${output}`);
    if (!fs.existsSync(src)) throw new Error(`Build source does not exist: ${source}`);
    if (fs.statSync(src).isDirectory()) {
        for (const name of fs.readdirSync(src)) copyEntry(root, dist, { source: `${source}/${name}`, output: `${output}/${name}` });
    } else {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
    }
}
function build(projectDir = process.cwd()) {
    const root = path.resolve(projectDir);
    const site = readJson(path.join(root, 'site.json'));
    const xml = fs.readFileSync(path.join(root, 'site.xml'), 'utf8');
    const buildTag = xml.match(/<build\b[^>]*>/i);
    if (!buildTag) throw new Error('site.xml is missing its <build> element.');
    const output = safeRel(attrs(buildTag[0]).output || 'dist', 'build output');
    const dist = path.resolve(root, output);
    if (!dist.startsWith(root + path.sep)) throw new Error('Build output must stay inside the project.');
    fs.rmSync(dist, { recursive: true, force: true });
    fs.mkdirSync(dist, { recursive: true });

    const copies = [...xml.matchAll(/<copy(?=\s)[^>]*\/?\s*>/gi)].map((m) => attrs(m[0]));
    for (const copy of copies) copyEntry(root, dist, copy);

    const pages = [...xml.matchAll(/<page\b[^>]*\/?\s*>/gi)].map((m) => attrs(m[0]));
    const builtPages = [];
    for (const descriptor of pages) {
        const pagePath = safeRel(descriptor.output, 'page output');
        const layoutPath = safeRel(descriptor.layout, 'layout');
        const contentPath = safeRel(descriptor.content, 'content');
        const configPath = safeRel(descriptor.config, 'page config');
        const config = readJson(path.join(root, configPath));
        let html = fs.readFileSync(path.join(root, layoutPath), 'utf8');
        const markdown = fs.existsSync(path.join(root, contentPath)) ? fs.readFileSync(path.join(root, contentPath), 'utf8') : '';
        const chunks = markdown.trim() ? splitMarkdown(markdown) : [];
        let index = 0;
        html = html.replace(/<md\b[^>]*>\s*<\/md\s*>|<md\b[^>]*\/>/gi, () => {
            if (index >= chunks.length) throw new Error(`Page ${descriptor.name} has more <md> tags than Markdown sections.`);
            return markdownToHTML(chunks[index++], { externalLinks: true });
        });
        if (index !== chunks.length) throw new Error(`Page ${descriptor.name} has ${index} <md> tags but ${chunks.length} Markdown sections.`);
        if (html.includes('{{content}}')) {
            if (!chunks.length) html = html.replace(/\{\{content\}\}/g, '');
            else if (chunks.length === 1) html = html.replace(/\{\{content\}\}/g, markdownToHTML(chunks[0], { externalLinks: true }));
            else throw new Error(`Page ${descriptor.name} uses {{content}} with multiple Markdown sections; use matching <md></md> tags.`);
        }
        html = interpolate(html, site, { ...config, name: config.page || descriptor.name, path: pagePath });
        const target = path.resolve(dist, pagePath);
        if (!target.startsWith(dist + path.sep)) throw new Error(`Page output escapes dist/: ${pagePath}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, html, 'utf8');
        builtPages.push({ path: pagePath, text: plainText(html) });
    }
    const siteUrl = String(site.url || '').replace(/\/+$/, '');
    const manifest = {
        id: '/', name: site.name || 'Website', short_name: site.short_name || site.name || 'Website',
        description: site.description || '', lang: site.lang || undefined, dir: site.dir || undefined,
        start_url: '/', scope: '/', display: 'standalone', background_color: site.theme_color || '#ffffff',
        theme_color: site.theme_color || '#ffffff', icons: [site.icon_192, site.icon_512].filter(Boolean).map((src, i) => ({ src, sizes: i ? '512x512' : '192x192' })),
    };
    const generatorDefaults = { manifest: ['manifest.webmanifest', true], sitemap: ['sitemap.xml', true], robots: ['robots.txt', true], aiContext: ['ai-context.txt', true] };
    const generators = Object.fromEntries(Object.entries(generatorDefaults).map(([key, [file, enabled]]) => {
        const value = site.generators?.[key] || {};
        return [key, { file: safeRel(value.file || file, `${key} output`), enabled: value.enabled !== false }];
    }));
    const generatedFiles = Object.values(generators).filter((item) => item.enabled).map((item) => item.file.toLowerCase());
    if (new Set(generatedFiles).size !== generatedFiles.length) throw new Error('Generated file output paths must be unique.');
    const reservedOutputs = [...pages.map((p) => p.output.toLowerCase()), ...copies.map((c) => String(c.output || c.source).replace(/\/+$/, '').toLowerCase())];
    if (generatedFiles.some((file) => reservedOutputs.includes(file))) throw new Error('Generated file names cannot overwrite a copied file or page.');
    const writeGenerated = (name, contents) => { const target = path.join(dist, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, contents, 'utf8'); };
    if (generators.manifest.enabled) writeGenerated(generators.manifest.file, JSON.stringify(manifest, null, 2) + '\n');
    const urls = builtPages.map(({ path: pagePath }) => {
        const href = pagePath.toLowerCase() === 'index.html' ? `${siteUrl}/` : `${siteUrl}/${pagePath.split('/').map(encodeURIComponent).join('/')}`;
        return `  <url><loc>${xmlEscape(href || `/${pagePath}`)}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`;
    }).join('\n');
    if (generators.sitemap.enabled) writeGenerated(generators.sitemap.file, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    if (generators.robots.enabled) writeGenerated(generators.robots.file, `User-agent: *\nAllow: /\n${siteUrl && generators.sitemap.enabled ? `Sitemap: ${siteUrl}/${generators.sitemap.file.split('/').map(encodeURIComponent).join('/')}\n` : ''}`);
    const context = [`Website: ${site.name || 'Website'}`, site.description || '', '', ...builtPages.map((page) => `${page.path}: ${page.text}`)].filter(Boolean).join('\n');
    if (generators.aiContext.enabled) writeGenerated(generators.aiContext.file, context + '\n');
    return { output: dist, pages: pages.length, copies: copies.length };
}
if (require.main === module) {
    try { const result = build(process.argv[2] || process.cwd()); console.log(`Built ${result.pages} page(s) in ${result.output} (${result.copies} copy rule(s)).`); }
    catch (error) { console.error(`Build failed: ${error.message}`); process.exitCode = 1; }
}
module.exports = { build, splitMarkdown, interpolate };
