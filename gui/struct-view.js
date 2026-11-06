'use strict';
/* Visualize the publish tree described by site.xml. */
window.StructView = (() => {
    let source = '';
    const collapsed = new Set();
    const escText = (s) => esc(String(s || ''));

    function parse(xmlText) {
        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('site.xml is not valid XML.');
        const build = doc.querySelector('site > build');
        if (!build) throw new Error('site.xml does not contain a build structure.');
        const rootName = build.getAttribute('output') || 'dist';
        const root = { name: rootName, kind: 'root', children: new Map() };
        const add = (rel, kind, meta = {}) => {
            const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            if (!clean || clean.split('/').some((part) => !part || part === '.' || part === '..')) return;
            const parts = clean.split('/'); let node = root;
            parts.forEach((part, index) => {
                if (!node.children.has(part)) node.children.set(part, { name: part, kind: index === parts.length - 1 ? kind : 'folder', children: new Map(), meta: index === parts.length - 1 ? meta : {} });
                node = node.children.get(part);
                if (index === parts.length - 1 && kind !== 'folder') { node.kind = kind; node.meta = meta; }
            });
        };
        for (const copy of build.querySelectorAll(':scope > copy-files > copy')) {
            const output = copy.getAttribute('output') || copy.getAttribute('source');
            const isDir = /\/$/.test(output || '') || /\/$/.test(copy.getAttribute('source') || '');
            add(output, isDir ? 'copy-folder' : 'copy-file', { source: copy.getAttribute('source') || '', type: copy.getAttribute('type') || 'file' });
        }
        for (const page of build.querySelectorAll(':scope > pages > page')) {
            const output = page.getAttribute('output') || page.getAttribute('path');
            add(output, 'page', {
                page: page.getAttribute('name') || '', config: page.getAttribute('config') || '',
                layout: page.getAttribute('layout') || '', content: page.getAttribute('content') || '',
            });
        }
        return { rootName, root, pages: build.querySelectorAll(':scope > pages > page').length, copies: build.querySelectorAll(':scope > copy-files > copy').length };
    }
    const glyph = (kind) => kind === 'root' || kind.includes('folder') ? '▰' : kind === 'page' ? '◉' : '▤';
    const label = (kind) => kind === 'page' ? 'HTML page' : kind === 'copy-folder' || kind === 'folder' ? 'Folder' : kind === 'root' ? 'Build output' : 'Copied file';
    function draw(node, depth = 0, parent = '') {
        const children = [...node.children.values()].sort((a, b) => {
            const af = a.children.size > 0 || a.kind.includes('folder'), bf = b.children.size > 0 || b.kind.includes('folder');
            return Number(bf) - Number(af) || a.name.localeCompare(b.name);
        });
        const rows = children.map((child) => {
            const rel = parent ? `${parent}/${child.name}` : child.name;
            const isFolder = child.children.size > 0 || child.kind.includes('folder');
            const closed = collapsed.has(rel);
            const detail = child.kind === 'page'
                ? `<span class="struct-tag">${escText(child.meta.page)}</span>`
                : child.kind === 'copy-file' ? `<span class="struct-tag">${escText(child.meta.type || 'file')}</span><span class="struct-origin">${escText(child.meta.source)}</span>` : '';
            return `<div class="struct-row ${isFolder ? 'is-folder' : 'is-file'}" ${isFolder ? `data-struct-toggle="${escText(rel)}"` : ''}>
                <span class="struct-arrow">${isFolder ? (closed ? '›' : '⌄') : ''}</span><span class="struct-node-icon kind-${child.kind}">${glyph(child.kind)}</span><span class="struct-node-name" title="${escText(rel)}">${escText(child.name)}</span>${detail}<span class="struct-node-kind">${label(child.kind)}</span></div>
                ${isFolder && !closed ? `<div class="struct-children">${draw(child, depth + 1, rel)}</div>` : ''}`;
        }).join('');
        return rows || (node.kind === 'root' ? '<div class="struct-empty">No output files are registered yet.</div>' : '');
    }
    function renderTree(data) {
        const tree = $('#struct-tree'); if (!tree) return;
        tree.innerHTML = `<div class="struct-row is-folder struct-root-row" data-struct-toggle="${escText(data.rootName)}"><span class="struct-arrow">${collapsed.has(data.rootName) ? '›' : '⌄'}</span><span class="struct-node-icon kind-root">${glyph('root')}</span><span class="struct-node-name">${escText(data.rootName)}/</span><span class="struct-node-kind">Build output</span></div>${collapsed.has(data.rootName) ? '' : `<div class="struct-children">${draw(data.root, 0, data.rootName)}</div>`}`;
    }
    async function render() {
        const root = $('#v-structure'); if (!root) return;
        root.innerHTML = `<div class="struct-page"><header class="struct-header"><div><span class="struct-kicker">PUBLISH MAP</span><h1>Site Structure</h1><p>Preview of the files that the build will create in <code>dist/</code>.</p></div><button class="struct-refresh" data-struct-refresh title="Refresh structure" aria-label="Refresh structure">${icon('refresh')}<span>Refresh</span></button></header><div id="struct-feedback" class="struct-feedback">Reading site.xml…</div><section class="struct-overview" id="struct-overview"></section><section class="struct-tree-panel"><div class="struct-tree-head"><div><h2>Output files</h2><span>Generated from page JSON in <code>configs/</code></span></div><div class="struct-legend"><span><i class="page"></i>Page</span><span><i class="copy"></i>Copied</span></div></div><div class="struct-tree" id="struct-tree"></div></section></div>`;
        try {
            source = await api.structure();
            const data = parse(source);
            $('#struct-feedback').textContent = 'Structure is based on site.xml and the current page configurations.';
            $('#struct-overview').innerHTML = `<div class="struct-stat"><span>HTML pages</span><b>${data.pages}</b></div><div class="struct-stat"><span>Copy rules</span><b>${data.copies}</b></div><div class="struct-stat"><span>Output folder</span><b>${escText(data.rootName)}/</b></div>`;
            renderTree(data);
        } catch (err) {
            $('#struct-feedback').classList.add('error');
            $('#struct-feedback').textContent = err.message;
            $('#struct-tree').innerHTML = '';
        }
    }
    function handleClick(e) {
        const refresh = e.target.closest('[data-struct-refresh]');
        if (refresh) { e.preventDefault(); render(); return true; }
        const toggle = e.target.closest('[data-struct-toggle]');
        if (toggle) { const key = toggle.dataset.structToggle; collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key); try { renderTree(parse(source)); } catch (e2) { /* render keeps the existing error state */ } return true; }
        return false;
    }
    document.addEventListener('click', (e) => { if (handleClick(e)) e.stopPropagation(); });
    return { render };
})();
