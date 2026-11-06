'use strict';
/* Build the publish structure from page descriptors in configs/p.*.json. */
const fs = require('fs');
const path = require('path');

const posix = (value) => value.split(path.sep).join('/');
const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;');

function walkJson(dir, base = dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
        const file = path.join(dir, name);
        const stat = fs.statSync(file);
        if (stat.isDirectory()) walkJson(file, base, out);
        else if (/^p\..+\.json$/i.test(name) && !/^p\.(styles|scripts)\.json$/i.test(name)) out.push(posix(path.relative(base, file)));
    }
    return out;
}

function pageDescriptors(projectDir) {
    const configsDir = path.join(projectDir, 'configs');
    const files = walkJson(configsDir).map((rel) => posix(path.join('configs', rel)));
    const pages = files.map((configRel) => {
        const abs = path.join(projectDir, configRel);
        let data;
        try { data = JSON.parse(fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '')); }
        catch (err) { throw new Error(`Invalid page config ${configRel}: ${err.message}`); }
        const page = String(data.page || '').trim();
        const output = String(data.path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        const segments = output.split('/');
        if (!page) throw new Error(`Page config ${configRel} must include a non-empty "page" value.`);
        if (!output || !/\.html$/i.test(output) || segments.some((part) => !part || part === '.' || part === '..')) {
            throw new Error(`Page config ${configRel} must include a safe relative HTML "path".`);
        }
        const stem = output.replace(/\.html$/i, '');
        return { name: page, output, config: configRel, layout: `layouts/${stem}.html`, content: `data/${stem}.md` };
    });
    const names = new Set(), outputs = new Set();
    for (const page of pages) {
        const outKey = page.output.toLowerCase();
        if (names.has(page.name)) throw new Error(`More than one page config uses the page name "${page.name}".`);
        if (outputs.has(outKey)) throw new Error(`More than one page config builds to "${page.output}".`);
        names.add(page.name); outputs.add(outKey);
    }
    return pages.sort((a, b) => a.output.localeCompare(b.output));
}

function renderSiteXml(pages, copies = []) {
    const copyXml = copies.map((copy) => `      <copy source="${xml(copy.source)}" output="${xml(copy.output)}" type="${xml(copy.type)}" />`).join('\n');
    const entries = pages.map((page) => `      <page name="${xml(page.name)}" config="${xml(page.config)}" layout="${xml(page.layout)}" content="${xml(page.content)}" output="${xml(page.output)}" />`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<site>\n  <build output="dist">\n    <copy-files>\n${copyXml}\n    </copy-files>\n    <pages>\n${entries}\n    </pages>\n  </build>\n</site>\n`;
}

function copyDescriptors(projectDir) {
    const mappings = [];
    for (const [file, type] of [['p.styles.json', 'style'], ['p.scripts.json', 'script']]) {
        const abs = path.join(projectDir, 'configs', file);
        if (!fs.existsSync(abs)) continue;
        let values;
        try { values = JSON.parse(fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '')); }
        catch (err) { throw new Error(`Invalid file map configs/${file}: ${err.message}`); }
        if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error(`File map configs/${file} must be a JSON object.`);
        for (const [sourceValue, outputValue] of Object.entries(values)) {
            const safe = (rel) => {
                const normalized = String(rel || '').replace(/\\/g, '/');
                return normalized && !normalized.startsWith('/') && !/^[a-z]:/i.test(normalized)
                    && normalized.split('/').every((part) => part && part !== '.' && part !== '..') ? normalized.replace(/\/+$/g, '') : '';
            };
            const source = safe(sourceValue), output = safe(outputValue);
            if (!source || !output) throw new Error(`Invalid source or dist path in configs/${file}: ${sourceValue}`);
            mappings.push({ source, output, type });
        }
    }
    const outputs = new Set();
    for (const entry of mappings) {
        const key = entry.output.toLowerCase();
        if (outputs.has(key)) throw new Error(`More than one file map points to dist/${entry.output}.`);
        outputs.add(key);
    }
    return mappings;
}

function update(projectDir = process.cwd()) {
    const root = path.resolve(projectDir);
    if (!fs.existsSync(path.join(root, 'configs')) || !fs.statSync(path.join(root, 'configs')).isDirectory()) {
        throw new Error('Project has no configs/ directory.');
    }
    const pages = pageDescriptors(root);
    const copies = [
        { source: 'site.json', output: 'site.json', type: 'file' },
        { source: 'assets/', output: 'assets/', type: 'directory' },
        ...copyDescriptors(root),
    ];
    fs.writeFileSync(path.join(root, 'site.xml'), renderSiteXml(pages, copies), 'utf8');
    return { file: path.join(root, 'site.xml'), pages, copies };
}

if (require.main === module) {
    try {
        const result = update(process.argv[2] || process.cwd());
        process.stdout.write(`Updated ${result.file} (${result.pages.length} page${result.pages.length === 1 ? '' : 's'}).\n`);
    } catch (err) {
        process.stderr.write(`${err.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = { update, pageDescriptors, copyDescriptors, renderSiteXml };
