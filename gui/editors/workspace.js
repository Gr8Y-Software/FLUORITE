'use strict';
/* Shared tab workspaces: content fields, source code, Markdown regions and previews. */

const FIELD_TYPES = [['text', 'Text'], ['textarea', 'Long text'], ['number', 'Number'], ['bool', 'Yes / no'], ['date', 'Date'], ['image', 'Image'], ['list', 'List or object (JSON)']];
const getPath = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) {
    const parts = String(p).split('.'); const last = parts.pop();
    const t = parts.reduce((a, k) => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; return a[k]; }, o);
    t[last] = v;
}
const objectFor = (t) => (t.kind === 'item' ? t.item : S.P.files[t.file]);

/* ---------- opening things ---------- */
function showTab(i) { S.active = i; setView('editor'); renderExplorer(); renderStatus(); }
async function openItem(file, key, item) {
    let i = S.tabs.findIndex((t) => t.item === item);
    if (i < 0) {
        const t = { kind: 'item', file, key, item, md: null, mdDirty: false };
        if (item.content) { t.md = await guard(() => api.readMd(item.content)); if (t.md == null) return; }
        S.tabs.push(t); i = S.tabs.length - 1;
    }
    showTab(i);
}
function openSettings(file) {
    let i = S.tabs.findIndex((t) => t.id === 'settings:' + file);
    if (i < 0) { S.tabs.push({ kind: 'settings', id: 'settings:' + file, file, raw: false }); i = S.tabs.length - 1; }
    showTab(i);
}
async function openSource(rel) {
    if (/\.md$/i.test(rel)) return MarkdownEditor.open(rel);
    if (/\.json$/i.test(rel)) return ConfigView.open(rel);
    let i = S.tabs.findIndex((t) => t.id === 'src:' + rel);
    if (i < 0) {
        const text = await guard(() => api.readText(rel));
        if (text == null) return;
        S.tabs.push({ kind: 'text', id: 'src:' + rel, rel, text, dirty: false, pos: { l: 1, c: 1 } }); i = S.tabs.length - 1;
    }
    showTab(i);
}
const regionFile = (name, scope) => (scope.type === 'coll' ? `data/regions/@${scope.key}/${name}.md` : scope.type === 'page' ? `data/regions/${scope.key}/${name}.md` : `data/regions/${name}.md`);
async function openRegion(name) {
    let i = S.tabs.findIndex((t) => t.id === 'region:' + name);
    if (i < 0) {
        const scope = { type: 'global', key: '' };
        const file = regionFile(name, scope);
        const md = await guard(() => api.readMd(file));
        if (md == null) return;
        S.tabs.push({ kind: 'md', id: 'region:' + name, name, block: false, scope, file, md, mdDirty: false, bufs: {} }); i = S.tabs.length - 1;
    }
    showTab(i);
}
async function openBlock(name) {
    let i = S.tabs.findIndex((t) => t.id === 'block:' + name);
    if (i < 0) {
        const file = `data/md/${name}.md`;
        const md = await guard(() => api.readMd(file));
        if (md == null) return;
        S.tabs.push({ kind: 'md', id: 'block:' + name, name, block: true, scope: null, file, md, mdDirty: false, bufs: {} }); i = S.tabs.length - 1;
    }
    showTab(i);
}
async function switchScope(t, value) {
    let scope;
    if (value === '__add') {
        const v = await ask({
            title: 'Override for one page', text: 'Write different content for this region on a single page. An empty override hides the region on that page.',
            fields: [{ name: 'slug', label: 'Page', placeholder: 'about', list: slugsForPages(), hint: 'The slug of the page (for a page in a folder: docs/intro).' }], ok: 'Create',
            validate: (v) => (/^[\p{L}\p{N}_-]+(\/[\p{L}\p{N}_-]+)*$/u.test(v.slug) ? null : 'Use letters, numbers, dashes and slashes.'),
        });
        if (!v) { renderEditor(); return; }
        scope = { type: 'page', key: v.slug };
    } else {
        const [type, ...rest] = value.split(':');
        scope = { type, key: rest.join(':') };
    }
    t.bufs[t.file] = { text: t.md, dirty: t.mdDirty };
    t.scope = scope; t.file = regionFile(t.name, scope);
    const b = t.bufs[t.file];
    if (b) { t.md = b.text; t.mdDirty = b.dirty; } else { t.md = await guard(() => api.readMd(t.file)) || ''; t.mdDirty = false; }
    renderEditor(); renderExplorer(); renderStatus();
}

async function closeTab(i, force) {
    const t = S.tabs[i]; if (!t) return;
    if (!force && tabDirty(t) && !(await confirmBox('Close without saving?', 'This tab has unsaved changes. Closing it keeps them in memory until you save, but they are lost if you quit.', 'Close tab'))) return;
    S.tabs.splice(i, 1);
    if (S.active > i || S.active >= S.tabs.length) S.active = Math.max(-1, Math.min(S.active - (S.active > i ? 1 : 0), S.tabs.length - 1));
    renderEditor(); renderExplorer(); renderStatus();
}
async function closeMany(keep) {
    const doomed = S.tabs.filter((t, i) => !keep(t, i));
    if (doomed.some(tabDirty) && !(await confirmBox('Close tabs with unsaved changes?', 'Some of these tabs have unsaved changes that will stay in memory only until you quit.', 'Close tabs'))) return;
    const active = cur();
    S.tabs = S.tabs.filter(keep);
    S.active = active && S.tabs.includes(active) ? S.tabs.indexOf(active) : S.tabs.length - 1;
    renderEditor(); renderExplorer(); renderStatus();
}

/* ---------- tabs ---------- */
const tabLabel = (t) => (t.kind === 'item' ? titleOf(t.item) : t.kind === 'settings' ? t.file : t.kind === 'text' ? t.rel.split('/').pop() : t.name);
const tabKind = (t) => (t.kind === 'md' ? (t.block ? 'block' : 'region') : '');
function fileTypeIcon(rel) {
    const ext = (String(rel || '').match(/\.([^.\/]+)$/) || [, ''])[1].toLowerCase();
    const icons = {
        html: '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#e44d26" d="M5 3h22l-2 24-9 3-9-3z"/><path fill="#f16529" d="M16 5h9l-1.7 20L16 27z"/><path fill="#fff" d="M9 9h14l-.3 3H12l.3 3h10l-.8 8-5.5 1.8-5.5-1.8-.4-4h3l.2 1.8 2.7.8 2.7-.8.3-3.1H9.8z"/></svg>',
        js: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="3" fill="#f1e05a"/><path fill="#222" d="M17 23.5c.6 1 1.3 1.7 2.7 1.7 1.1 0 1.8-.5 1.8-1.2 0-.9-.7-1.2-2-1.7l-.7-.3c-2-.8-3.3-1.8-3.3-3.9 0-1.9 1.5-3.4 3.9-3.4 1.7 0 2.9.6 3.8 2.1l-2.1 1.4c-.5-.8-.9-1.1-1.7-1.1-.8 0-1.3.5-1.3 1.1 0 .8.5 1.1 1.7 1.6l.7.3c2.4 1 3.7 2 3.7 4.2 0 2.4-1.9 3.7-4.5 3.7-2.5 0-4.1-1.2-4.9-2.8zM7 23.7c.4.7.8 1.3 1.7 1.3.8 0 1.3-.3 1.3-1.6v-8.5h2.7v8.5c0 2.8-1.6 4.1-3.9 4.1-2.1 0-3.3-1.1-4-2.5z"/></svg>',
        css: '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#1572b6" d="M5 3h22l-2 24-9 3-9-3z"/><path fill="#33a9dc" d="M16 5h9l-1.7 20L16 27z"/><path fill="#fff" d="M9 9h14l-.3 3H12l.2 2h10l-.8 8-5.4 1.8-5.5-1.8-.3-3.8h3l.2 1.7 2.7.8 2.7-.8.3-3H9.8z"/></svg>',
        json: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f0c44b" d="M5 2h9l5 5v15H5z"/><path fill="#fff3c4" d="M14 2v5h5"/><path fill="#493d1b" d="M10 10c-2 0-2 1-2 2v1c0 .7-.2 1-1 1 .8 0 1 .3 1 1v1c0 1 .5 2 2 2v-1c-.7 0-.8-.4-.8-1v-1c0-.8-.3-1.2-.9-1.5.6-.3.9-.7.9-1.5v-1c0-.6.1-1 .8-1zm4 0v1c.7 0 .8.4.8 1v1c0 .8.3 1.2.9 1.5-.6.3-.9.7-.9 1.5v1c0 .6-.1 1-.8 1v1c1.5 0 2-1 2-2v-1c0-.7.2-1 1-1-.8 0-1-.3-1-1v-1c0-1-.5-2-2-2z"/></svg>',
        xml: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#7b9ce1" d="M5 2h9l5 5v15H5z"/><path fill="#c7d5f4" d="M14 2v5h5"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m10 11-2 2 2 2m4-4 2 2-2 2"/></svg>',
        md: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#5194d2" d="M5 2h9l5 5v15H5z"/><path fill="#9cc8f0" d="M14 2v5h5"/><path fill="#fff" d="M7 15v-4l2 2 2-2v4h-1v-2l-1 1-1-1v2zm7 0-2-2h1v-2h2v2h1z"/></svg>',
        txt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#8b929e" d="M5 2h9l5 5v15H5z"/><path fill="#c5c9d0" d="M14 2v5h5"/><path stroke="#fff" stroke-width="1.3" d="M8 12h8M8 15h8M8 18h6"/></svg>',
    };
    return icons[ext] || '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 2h9l5 5v15H5z"/><path fill="none" stroke="var(--bg0)" stroke-width="1.4" d="M8 12h8M8 15h8M8 18h5"/></svg>';
}
function renderTabs() {
    const active = cur();
    const isSource = active && active.kind === 'text';
    const ext = isSource ? (active.rel.match(/\.([^.\/]+)$/) || [, 'file'])[1].toUpperCase() : active ? active.kind.toUpperCase() : '';
    const label = isSource ? active.rel.split('/').pop() : active ? tabLabel(active) : '';
    const info = `<div class="tab-file-info${active ? '' : ' empty'}" title="${esc(isSource ? active.rel : label)}">${active ? `<span class="tab-file-icon">${isSource ? fileTypeIcon(active.rel) : '<span class="generic-file-icon">◆</span>'}</span><span class="tab-file-name">${esc(label)}</span><small>${esc(ext)}</small>` : !S.tabs.length ? '<span class="tab-file-name">Coral Studio</span><small>WELCOME</small>' : ''}</div>`;
    $('#tabs').innerHTML = info + S.tabs.map((t, i) => `<div class="tab${i === S.active ? ' on' : ''}${tabDirty(t) ? ' dirty' : ''}" data-tab="${i}" data-ctx="tab:${i}" title="${esc(t.rel || t.file || '')}"><span>${esc(tabLabel(t))}</span>${tabKind(t) ? `<small>${tabKind(t)}</small>` : ''}<button class="x" data-close="${i}" aria-label="Close tab"></button></div>`).join('');
    const on = $('.tab.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* ---------- fields ---------- */
function inferType(k, v) {
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return 'number';
    if (v && typeof v === 'object') return 'list';
    const s = String(v ?? '');
    if (k === 'image' || k === 'logo' || k === 'og_image' || k === 'cover' || k === 'thumbnail') return 'image';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || k === 'date' || k === 'updated') return 'date';
    if (s.length > 70 || /description|summary|subtitle|blurb|instructions|greeting|excerpt/.test(k)) return 'textarea';
    return 'text';
}
function fieldsFor(t) {
    const obj = objectFor(t);
    let defs = [];
    if (t.kind === 'item') {
        const c = collections().find((x) => x.file === t.file && x.key === t.key);
        for (const f of (c && c.cfg && c.cfg.fields) || []) defs.push({ k: f.name, type: f.type || inferType(f.name, obj[f.name]), label: f.label || f.name, options: f.options });
        for (const k of Object.keys(obj)) if (k !== 'content' && !defs.some((d) => d.k === k)) defs.push({ k, type: inferType(k, obj[k]), label: k });
        defs = defs.filter((d) => d.k !== 'content' && d.k !== 'slug');
        defs.splice(Math.min(1, defs.length), 0, { k: 'slug', type: 'text', label: 'Slug' }); // right after the title
    } else {
        for (const k of Object.keys(obj)) defs.push({ k, type: inferType(k, obj[k]), label: k });
    }
    return defs;
}
function fieldHTML(d, v, prefix = '') {
    const k = prefix + d.k, id = 'f-' + k.replace(/[^\w]/g, '_');
    const label = `<label for="${id}">${esc(d.label)}</label>`;
    const a = `id="${id}" data-k="${esc(k)}"`;
    const plainObj = v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => x === null || typeof x !== 'object');
    if (plainObj && d.type === 'list' && !prefix) {
        return `<fieldset class="grp"><legend>${esc(d.label)}</legend>${Object.keys(v).map((kk) => fieldHTML({ k: kk, type: inferType(kk, v[kk]), label: kk }, v[kk], k + '.')).join('')}</fieldset>`;
    }
    switch (d.type) {
    case 'bool': return `<div class="f inline">${label}<span class="switch"><input type="checkbox" ${a} data-t="b" ${v ? 'checked' : ''}><i></i></span></div>`;
    case 'number': return `<div class="f">${label}<input type="number" ${a} data-t="n" value="${esc(v ?? 0)}"></div>`;
    case 'date': return `<div class="f">${label}<input type="date" ${a} data-t="s" value="${esc(v ?? '')}"></div>`;
    case 'image': return `<div class="f">${label}<input type="text" ${a} data-t="s" value="${esc(v ?? '')}" list="media-list" placeholder="file name from the Media library"></div>`;
    case 'select': return `<div class="f">${label}<select ${a} data-t="s">${(d.options || []).map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    case 'list': { const j = JSON.stringify(v ?? [], null, 2); return `<div class="f">${label}<textarea class="json" ${a} data-t="j" spellcheck="false" dir="ltr" rows="${Math.min(14, j.split('\n').length + 1)}">${esc(j)}</textarea></div>`; }
    case 'textarea': return `<div class="f">${label}<textarea ${a} data-t="s" dir="auto" rows="${String(v ?? '').length > 160 ? 6 : 3}">${esc(v ?? '')}</textarea></div>`;
    default: {
        const s = String(v ?? '');
        const color = /^#[0-9a-f]{6}$/i.test(s) ? `<input type="color" data-k="${esc(k)}" data-t="s" value="${esc(s)}" class="swatch" aria-label="Pick a color for ${esc(d.label)}">` : '';
        return `<div class="f">${label}<div class="inp-row"><input type="text" ${a} data-t="s" value="${esc(s)}" dir="auto">${color}</div></div>`;
    }
    }
}

/* ---------- editor rendering ---------- */
function paneButtons() {
    return `<div class="panebar"><span class="seg" role="group" aria-label="Pane">${[['fields', 'Fields'], ['write', 'Write'], ['preview', 'Preview']].map(([k, l]) => `<button data-pane="${k}" class="${(S.pane || 'write') === k ? 'on' : ''}">${l}</button>`).join('')}</span></div>`;
}
function docClasses(extra = '') {
    const L = S.L;
    return `doc${extra}${!L.fieldsOpen || L.focus ? ' no-fields' : ''}${!L.previewOpen || L.focus ? ' no-pv' : ''}`;
}
function mdTools() {
    return `<div class="tools" id="tools"><button data-md="b" title="Bold (Ctrl B)"><b>B</b></button><button data-md="i" title="Italic (Ctrl I)"><i>I</i></button>
        <button data-md="h2" title="Heading">H2</button><button data-md="h3" title="Subheading">H3</button><button data-md="ul" title="Bullet list">List</button><button data-md="q" title="Quote">Quote</button>
        <button data-md="code" title="Code">Code</button><button data-md="link" title="Link">Link</button><button data-md-menu="insert" title="Insert…">Insert ▾</button><span class="sp"></span>
        <button class="ghost" data-act="toggle-fields" title="Show or hide the fields panel (Ctrl Alt B)">Fields</button><button class="ghost" data-act="toggle-preview" title="Show or hide the live preview (Ctrl \\)">Preview</button><button class="ghost" data-act="toggle-focus" title="Focus mode (Ctrl .)">Focus</button></div>`;
}
function previewPane(label) {
    return `<section class="stage-pv"><div class="pane-head"><span class="grow">Live preview</span><span>${esc(label || '')}</span></div><iframe id="pv" sandbox="allow-same-origin" title="Markdown preview"></iframe></section>`;
}
function renderEditor() {
    disposeCodeEditor();
    renderTabs();
    const body = $('#editor-body');
    const t = cur();
    if (!t) {
        body.innerHTML = `<section class="editor-welcome"><header class="editor-welcome-head"><img src="logo.png" alt=""><div><span class="editor-welcome-kicker">CORAL STUDIO · CODE WORKSPACE</span><h1>Your workspace is ready</h1><p>Open a project file to start editing. Here’s a live preview of the editor.</p></div></header><div class="editor-welcome-card"><div class="editor-welcome-filebar"><span><i></i><b>src/site.js</b></span><small>READ-ONLY PREVIEW</small></div><div class="monaco-code" id="monaco-editor" aria-label="Read-only Monaco editor preview"></div></div><footer class="editor-welcome-foot"><span>Syntax highlighting · Line numbers · 80+ languages</span><span>Open a file from Explorer or press <kbd>Ctrl K</kbd></span></footer></section>`;
        mountMonacoWelcome();
        return;
    }
    if (t.kind === 'item') {
        const obj = t.item, hasMd = t.md != null;
        const c = collections().find((x) => x.file === t.file && x.key === t.key);
        const url = c ? itemUrl(c, obj) : '';
        const fields = `<aside class="fields"><h2 id="doc-title">${esc(titleOf(obj))}</h2><div class="path">${esc(t.file)} · ${esc(t.key)}${obj.content ? ' · ' + esc(obj.content) : ''}${url ? ' · → ' + esc(url) : ''}</div>
            ${fieldsFor(t).map((d) => fieldHTML(d, obj[d.k])).join('')}
            <datalist id="media-list">${S.P.media.map((m) => `<option value="${esc(m.name)}">`).join('')}</datalist>
            <button data-act="addfield">Add field</button></aside>`;
        body.innerHTML = hasMd
            ? `<div class="${docClasses()}" data-pane="${S.pane || 'write'}">${paneButtons()}${fields}<div class="split-e" id="sp-fields"></div><section class="writer">${mdTools()}<textarea id="md" spellcheck="false" dir="auto" aria-label="Markdown content">${esc(t.md)}</textarea></section><div class="split-e" id="sp-pv"></div>${previewPane(obj.content)}</div>`
            : `<div class="${docClasses(' solo')}">${fields}</div>`;
        if (hasMd) { wireEditorSplitters(); schedulePreview(0); }
    } else if (t.kind === 'settings') {
        const obj = S.P.files[t.file];
        body.innerHTML = `<div class="doc solo"><aside class="fields"><h2>${esc(t.file)}</h2><div class="path">data/${esc(t.file)}</div>
            <div class="rbar" style="margin:0 -16px 14px"><span class="seg" role="group" aria-label="Mode"><button data-set-mode="form" class="${t.raw ? '' : 'on'}">Form</button><button data-set-mode="raw" class="${t.raw ? 'on' : ''}">JSON</button></span></div>
            ${t.raw ? `<textarea class="code" id="rawjson" spellcheck="false" dir="ltr" style="min-height:60vh;border:1px solid var(--line);border-radius:6px">${esc(JSON.stringify(obj, null, 2))}</textarea>`
        : `${fieldsFor(t).map((d) => fieldHTML(d, obj[d.k])).join('')}<datalist id="media-list">${S.P.media.map((m) => `<option value="${esc(m.name)}">`).join('')}</datalist><button data-act="addfield">Add field</button>`}</aside></div>`;
    } else if (t.kind === 'text') {
        body.innerHTML = sourceEditorMarkup(t);
        mountCodeEditor(t);
    } else if (t.kind === 'md') {
        body.innerHTML = renderMdTab(t);
        wireEditorSplitters(); schedulePreview(0);
    }
    updateDocMode();
}
function renderMdTab(t) {
    let head;
    if (t.block) {
        head = `<div class="rbar"><b>${esc(t.name)}</b><span class="path" style="margin:0">${esc(t.file)}</span><span class="grow"></span></div><div class="note">Inserted wherever a template contains <code>{{md:${esc(t.name)}}}</code>.</div>`;
    } else {
        const r = S.P.regions.find((x) => x.name === t.name) || { global: null, collections: [], pages: [], usedIn: [] };
        const sv = t.scope.type === 'global' ? 'global' : `${t.scope.type}:${t.scope.key}`;
        const opts = [['global', 'Everywhere (global)' + (r.global ? ' ●' : '')]];
        for (const c of collections()) if (c.cfg && c.cfg.template) opts.push([`coll:${c.name}`, `All “${c.label}” pages` + (r.collections.some((x) => x.collection === c.name) ? ' ●' : '')]);
        const slugs = new Set(r.pages.map((p) => p.slug)); if (t.scope.type === 'page') slugs.add(t.scope.key);
        for (const s of slugs) opts.push([`page:${s}`, `Page: ${s}` + (r.pages.some((p) => p.slug === s) ? ' ●' : '')]);
        opts.push(['__add', '+ Override for a page…']);
        head = `<div class="rbar"><b>${esc(t.name)}</b><label style="color:var(--tx3)">Scope <select id="scope">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === sv ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            <span class="path" style="margin:0;flex:1">${esc(t.file)}</span>${r.usedIn.map((f) => `<span class="chip" data-open-src="${esc(f)}" title="Open ${esc(f)}">${esc(f.replace(/^src\//, ''))}</span>`).join('')}</div>
            <div class="note">Zone <code>{{region:${esc(t.name)}}}</code>. The most specific scope wins: page, then collection, then global. An empty page override hides the region on that page.${r.usedIn.length ? '' : ' <b>No template uses it yet.</b>'}</div>`;
    }
    return `<div class="mdtab">${head}<div class="${docClasses(' nofields')}" data-pane="${S.pane || 'write'}" style="flex:1;min-height:0">${paneButtons()}<section class="writer">${mdTools()}<textarea id="md" spellcheck="false" dir="auto" aria-label="Markdown content">${esc(t.md)}</textarea></section><div class="split-e" id="sp-pv"></div>${previewPane(t.file)}</div></div>`;
}

/* ---------- resizable panes ---------- */
function wireEditorSplitters() {
    const sf = $('#sp-fields'), sp = $('#sp-pv');
    const bodyW = () => ($('#editor-body') ? $('#editor-body').clientWidth : window.innerWidth);
    if (sf) splitter(sf, { axis: 'x', get: () => S.L.fieldsW, set: (v) => setLayout({ fieldsW: v }), min: 200, max: () => Math.floor(bodyW() * 0.55), dir: 1, reset: () => setLayout({ fieldsW: LAYOUT_DEFAULTS.fieldsW }) });
    if (sp) splitter(sp, { axis: 'x', get: () => S.L.pvW, set: (v) => setLayout({ pvW: v }), min: 240, max: () => Math.floor(bodyW() * 0.7), dir: -1, reset: () => setLayout({ pvW: LAYOUT_DEFAULTS.pvW }) });
}
function updateDocMode() {
    const body = $('#editor-body'), doc = $('.doc', body || document);
    if (!body || !doc) return;
    const narrow = body.clientWidth < 820;
    doc.classList.toggle('narrow', narrow && !doc.classList.contains('solo'));
    doc.classList.toggle('no-fields', !S.L.fieldsOpen || S.L.focus);   // panel toggles apply live, no re-render
    doc.classList.toggle('no-pv', !S.L.previewOpen || S.L.focus);
    if (doc.dataset.pane === undefined) return;
    doc.dataset.pane = S.pane || 'write';
}
function setPane(p) { S.pane = p; const doc = $('.doc'); if (doc) { doc.dataset.pane = p; $$('[data-pane]', doc).forEach((b) => b.classList && b.tagName === 'BUTTON' && b.classList.toggle('on', b.dataset.pane === p)); } if (p === 'preview') schedulePreview(0); }

/* ---------- Markdown preview ---------- */
function pvDoc(html) {
    const base = `<base href="http://127.0.0.1:${S.P.port}/">`;
    if (isMaster()) {
        return `<!doctype html><meta charset="utf-8">${base}<link rel="stylesheet" href="styles/site.css"><link rel="stylesheet" href="styles/markdown.css">
<style>body{display:block;min-height:0;margin:0;padding:28px 34px 80px}img{max-width:100%;height:auto}</style><body dir="${esc((S.P.files['site.json'] || {}).dir || 'ltr')}"><article class="md">${html}</article>`;
    }
    return `<!doctype html><meta charset="utf-8">${base}<link rel="stylesheet" href="styles/markdown.css">
<style>body{margin:0;padding:34px 40px 80px;background:#fff;color:#1c1f26;font:16px/1.7 system-ui,sans-serif;max-width:780px}img{max-width:100%;height:auto}pre{overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px}</style>
<body><article class="md">${html}</article>`;
}
let pvTimer = 0;
function schedulePreview(delay = 220) {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(async () => {
        const t = cur(); const fr = $('#pv');
        if (!t || typeof t.md !== 'string' || !fr) return;
        try {
            let y = 0; try { y = fr.contentWindow.scrollY; } catch (e) { /* first load */ }
            const html = await api.renderMd(t.md);
            fr.onload = () => { try { fr.contentWindow.scrollTo(0, y); } catch (e) { /* ignore */ } };
            fr.srcdoc = pvDoc(html);
        } catch (e) { fr.srcdoc = `<body style="font:14px system-ui;padding:24px;color:#b00020">${esc(e.message)}</body>`; }
    }, delay);
}

/* ---------- dirty state & saving ---------- */
function markDirty(file) {
    S.dirtyFiles.add(file);
    renderTabs(); renderStatus();
    if ($('.row.unsaved') === null) renderExplorer();
}
function markTabDirty(t) { if (!t.dirty) { t.dirty = true; renderTabs(); renderExplorer(); } renderStatus(); }

async function saveTab(t) {
    if (t.kind === 'item') {
        if (t.mdDirty && t.item.content) { await api.writeMd(t.item.content, t.md); t.mdDirty = false; }
        if (S.dirtyFiles.has(t.file)) { await api.writeJson(t.file, S.P.files[t.file]); S.dirtyFiles.delete(t.file); }
    } else if (t.kind === 'settings') {
        if (S.dirtyFiles.has(t.file)) { await api.writeJson(t.file, S.P.files[t.file]); S.dirtyFiles.delete(t.file); }
    } else if (t.kind === 'text') {
        if (!t.dirty) return;
        if (/\.json$/i.test(t.rel)) { try { JSON.parse(t.text); } catch (e) { throw new Error(`${t.rel} is not valid JSON: ${e.message}`); } }
        await api.writeText(t.rel, t.text); t.dirty = false;
        if (t.rel === 'master.json') { await reloadProject(); renderAll(); } else await refreshScan();
    } else if (t.kind === 'md') {
        t.bufs[t.file] = { text: t.md, dirty: t.mdDirty };
        for (const [f, b] of Object.entries(t.bufs)) if (b.dirty) { await api.writeMd(f, b.text); b.dirty = false; }
        t.mdDirty = false;
        await refreshScan();
    }
}
async function saveAll() {
    for (const t of S.tabs) await saveTab(t);
    for (const f of [...S.dirtyFiles]) { await api.writeJson(f, S.P.files[f]); S.dirtyFiles.delete(f); }
    if (window.MarkdownEditor) await MarkdownEditor.saveAll();
    if (window.ConfigView && ConfigView.isDirty()) await ConfigView.save();
    renderTabs(); renderExplorer(); renderStatus();
}
async function saveCurrent() {
    const t = cur(); if (!t) return;
    await guard(async () => { await saveTab(t); renderTabs(); renderExplorer(); renderStatus(); toast('Saved'); });
}

/* ---------- Markdown toolbar ---------- */
function mdInsert(ta, text) {
    const s = ta.selectionStart;
    ta.setRangeText(text, s, ta.selectionEnd, 'end');
    ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
}
function mdAction(ta, kind) {
    const wrap = (b, a = b, ph = '') => { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText(b + (ta.value.slice(s, e) || ph) + a, s, e, 'select'); };
    const prefix = (p) => { const s = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1; ta.setRangeText(p, s, s, 'end'); };
    ({ b: () => wrap('**', '**', 'bold'), i: () => wrap('*', '*', 'italic'), code: () => wrap('`', '`', 'code'), link: () => wrap('[', '](https://)', 'text'), h2: () => prefix('## '), h3: () => prefix('### '), ul: () => prefix('- '), q: () => prefix('> ') }[kind] || (() => {}))();
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}
function insertMenu(x, y) {
    const ta = $('#md'); if (!ta) return;
    const media = S.P.media.slice(0, 30).map((m) => ({ label: m.name, run: () => mdInsert(ta, `![${m.name.replace(/\.\w+$/, '')}](assets/img/${m.name})`) }));
    PopMenu.open([
        { label: 'Image', items: media.length ? media : [{ label: 'No images in the Media library', disabled: true }] },
        { label: 'Card grid', run: () => mdInsert(ta, '\n::: card\n### Title\nShort text.\n:::\n\n::: card\n### Title\nShort text.\n:::\n') },
        { label: 'Note box', run: () => mdInsert(ta, '\n> [!NOTE]\n> Useful information.\n') },
        { label: 'Warning box', run: () => mdInsert(ta, '\n> [!WARNING]\n> Be careful.\n') },
        { label: 'Table', run: () => mdInsert(ta, '\n| Name | Value |\n| --- | --- |\n| One | 1 |\n| Two | 2 |\n') },
        { label: 'Divider', run: () => mdInsert(ta, '\n---\n') },
        { sep: true },
        { label: 'Value from site.json', items: ['name', 'email', 'tagline', 'url'].map((k) => ({ label: `{{site.${k}}}`, run: () => mdInsert(ta, `{{site.${k}}}`) })) },
    ], x, y);
}

