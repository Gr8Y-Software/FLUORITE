'use strict';
/* Wiring: menu bar, context menus, command palette, help dialogs, events, shortcuts, startup. */

/* ---------- help ---------- */
const SHORTCUTS = [
    ['Ctrl K  /  Ctrl P', 'Command palette: search pages, files, regions, commands'],
    ['Ctrl S  /  Ctrl Shift S', 'Save  /  save all'],
    ['Ctrl F  /  Ctrl H', 'Find  /  replace in the open code or Markdown file'],
    ['Ctrl G', 'Go to a line in the code editor'],
    ['F3  /  Shift F3', 'Next  /  previous search match'],
    ['Ctrl Shift B', 'Build the site'],
    ['Ctrl J', 'Show or hide the integrated PowerShell terminal'],
    ['F12  /  Ctrl Shift I', 'Show or hide docked developer tools'],
    ['Ctrl W  /  Ctrl Tab', 'Close editor tab  /  next editor tab'],
    ['Ctrl B', 'Show or hide the sidebar'],
    ['Ctrl \\', 'Show or hide the live preview'],
    ['Ctrl Alt B', 'Show or hide the fields panel'],
    ['Ctrl .', 'Focus mode (only the writing pane)'],
    ['Ctrl +  /  Ctrl −  /  Ctrl 0', 'Zoom the whole interface'],
    ['Alt 1 – 4', 'Dashboard, Code, Media, Preview'],
    ['F2  /  Delete', 'Rename  /  delete the selected item in the explorer'],
    ['F11', 'Full screen'],
    ['Drag a divider', 'Resize panels. Double-click a divider to reset it; arrow keys resize it from the keyboard'],
];
function helpShortcuts() {
    $('#overlay').hidden = false;
    $('#overlay').innerHTML = `<div class="modal wide" role="dialog" aria-label="Keyboard shortcuts"><h3>Keyboard shortcuts</h3><table>${SHORTCUTS.map(([k, d]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table><div class="btns"><button class="primary" id="m-cancel">Close</button></div></div>`;
    closeOnDismiss();
}
function helpSyntax() {
    const ex = (s) => `<pre>${esc(s)}</pre>`;
    $('#overlay').hidden = false;
    $('#overlay').innerHTML = `<div class="modal wide" role="dialog" aria-label="Template syntax"><h3>Template syntax</h3>
        <p>Used in <code>src/layout.html</code>, <code>src/pages</code>, <code>src/templates</code> and <code>src/partials</code>.</p>
        <table>
        <tr><td><code>{{site.name}}</code></td><td>A value. Escaped. Use <code>{{{x}}}</code> for raw HTML.</td></tr>
        <tr><td><code>{{date | date}}</code></td><td>Filters: raw upper lower trim truncate:N date default:"x" img link url json join:", " length slug md</td></tr>
        <tr><td><code>{{#if x}}…{{else}}…{{/if}}</code></td><td>Conditions: <code>x</code>, <code>!x</code>, <code>a == "b"</code>, <code>a != b</code>. Also <code>{{#unless x}}</code></td></tr>
        <tr><td><code>{{#each posts limit="3"}}</code></td><td>Loop over a collection or a list. Options: sort, order, limit, offset, where. Inside: <code>@index @first @last</code></td></tr>
        <tr><td><code>{{&gt; card title="x"}}</code></td><td>A partial from <code>src/partials/card.html</code>, with optional values</td></tr>
        <tr><td><code>{{region:sidebar}}</code></td><td>A zone filled with Markdown from <code>data/regions/</code> (page, collection or global scope)</td></tr>
        <tr><td><code>{{md:terms}}</code></td><td>The file <code>data/md/terms.md</code> converted to HTML</td></tr>
        <tr><td><code>{{root}}</code></td><td>Prefix to the site root (empty, or <code>../</code> in folders). Use it for links: <code>{{root}}{{url}}</code></td></tr>
        </table>${ex('{{#each posts sort="date" order="desc" limit="3"}}\n  <a href="{{root}}{{url}}">{{title}}</a> {{date | date}}\n{{else}}\n  Nothing yet.\n{{/each}}')}
        <p>In Markdown, links and images are relative to the site root: <code>![](assets/img/a.png)</code>, <code>[About](about.html)</code>, and <code>{{site.email}}</code> works too.</p>
        <div class="btns"><button class="primary" id="m-cancel">Close</button></div></div>`;
    closeOnDismiss();
}
function closeOnDismiss() {
    const ov = $('#overlay');
    const done = () => { ov.hidden = true; ov.innerHTML = ''; };
    $('#m-cancel').onclick = done;
    ov.onmousedown = (e) => { if (e.target === ov) done(); };
    ov.onkeydown = (e) => { if (e.key === 'Escape') done(); };
    $('#m-cancel').focus();
}
function helpAbout() {
    $('#overlay').hidden = false;
    $('#overlay').innerHTML = `<div class="modal" role="dialog" aria-label="About"><h3>Coral Studio</h3><p>Edit project files, build the site, and preview the result.</p><div class="btns"><button class="primary" id="m-cancel">Close</button></div></div>`;
    closeOnDismiss();
}

/* ---------- menus ---------- */
const hasTab = () => !!cur();
async function closeProject() {
    if (anyDirty() && !(await confirmBox('Close the project?', 'There are unsaved changes. They will be lost.', 'Close without saving', true))) return;
    showWelcome();
}
async function reloadFromDisk() {
    if (anyDirty() && !(await confirmBox('Reload from disk?', 'Unsaved changes will be lost.', 'Reload', true))) return;
    openProjectFlow(S.P.dir);
}
function editExec(cmd) {
    const el = document.activeElement;
    if (!el || !('value' in el)) return toast('Click into a text field first');
    el.focus();
    if (cmd === 'paste') navigator.clipboard.readText().then((tx) => document.execCommand('insertText', false, tx)).catch(() => toast('Clipboard is not available'));
    else if (cmd === 'selectAll') el.select();
    else document.execCommand(cmd);
}
async function menuDefs() {
    const recent = await api.recent().catch(() => []);
    if (!S.P) {
        const none = [{ label: 'No project open', disabled: true }];
        return {
            File: [
                { label: 'New project\u2026', run: newProjectFlow },
                { label: 'Open project\u2026', run: () => openProjectFlow() },
                { label: 'Open recent', items: recent.length ? recent.map((r) => ({ label: r.name + '  \u2014  ' + r.dir, run: () => openProjectFlow(r.dir) })) : [{ label: 'No recent projects', disabled: true }] },
            ],
            Edit: none,
            View: [
                { label: 'Zoom in', hint: 'Ctrl +', run: () => zoom('in') }, { label: 'Zoom out', hint: 'Ctrl \u2212', run: () => zoom('out') }, { label: 'Reset zoom', hint: 'Ctrl 0', run: () => zoom('reset') },
                { sep: true },
                { label: 'Full screen', hint: 'F11', run: () => api.windowAction('fullscreen') },
            ],
            Project: none,
            Help: [
                { label: 'Keyboard shortcuts', hint: 'F1', run: helpShortcuts },
                { label: 'Template syntax', run: helpSyntax },
                { label: 'Developer tools', hint: 'F12', run: () => api.windowAction('devtools') },
                { sep: true },
                { label: 'About Coral Studio', run: helpAbout },
            ],
        };
    }
    const L = S.L, t = cur();
    return {
        File: [
            { label: 'New project…', run: newProjectFlow },
            { label: 'Open project…', run: () => openProjectFlow() },
            { label: 'Open recent', items: recent.length ? recent.map((r) => ({ label: r.name + '  —  ' + r.dir, run: () => openProjectFlow(r.dir) })) : [{ label: 'No recent projects', disabled: true }] },
            { sep: true },
            { label: 'New', items: newMenuItems() },
            { sep: true },
            { label: 'Save', hint: 'Ctrl S', run: saveCurrent, disabled: !hasTab() },
            { label: 'Save all', hint: 'Ctrl Shift S', run: () => guard(async () => { await saveAll(); toast('All saved'); }) },
            { sep: true },
            { label: 'Close tab', hint: 'Ctrl W', run: () => closeTab(S.active), disabled: !hasTab() },
            { label: 'Close all tabs', run: () => closeMany(() => false), disabled: !S.tabs.length },
            { sep: true },
            { label: 'Close project', run: closeProject },
        ],
        Edit: [
            { label: 'Undo', hint: 'Ctrl Z', run: () => editExec('undo') }, { label: 'Redo', hint: 'Ctrl Y', run: () => editExec('redo') }, { sep: true },
            { label: 'Cut', hint: 'Ctrl X', run: () => editExec('cut') }, { label: 'Copy', hint: 'Ctrl C', run: () => editExec('copy') }, { label: 'Paste', hint: 'Ctrl V', run: () => editExec('paste') },
            { label: 'Select all', hint: 'Ctrl A', run: () => editExec('selectAll') }, { sep: true },
            { label: 'Search project…', hint: 'Ctrl K', run: openPalette },
        ],
        View: [
            { label: 'Sidebar', hint: 'Ctrl B', checked: L.expOpen, run: () => setLayout({ expOpen: !L.expOpen }) },
            { label: 'PowerShell terminal', hint: 'Ctrl J', checked: S.terminalOpen, run: () => toggleTerminal() },
            { label: 'Developer tools', hint: 'F12', checked: false, run: () => api.windowAction('devtools') },
            { label: 'Fields panel', hint: 'Ctrl Alt B', checked: L.fieldsOpen, run: () => { setLayout({ fieldsOpen: !L.fieldsOpen }); } },
            { label: 'Live preview', hint: 'Ctrl \\', checked: L.previewOpen, run: () => { setLayout({ previewOpen: !L.previewOpen }); } },
            { label: 'Focus mode', hint: 'Ctrl .', checked: L.focus, run: () => setLayout({ focus: !L.focus }) },
            { sep: true },
            ...VIEWS.map(([k, label], i) => ({ label, hint: 'Alt ' + (i + 1), run: () => setView(k) })),
            { sep: true },
            { label: 'Zoom in', hint: 'Ctrl +', run: () => zoom('in') }, { label: 'Zoom out', hint: 'Ctrl −', run: () => zoom('out') }, { label: 'Reset zoom', hint: 'Ctrl 0', run: () => zoom('reset') },
            { label: 'Editor text size', items: [{ label: 'Larger', run: () => setLayout({ edSize: Math.min(26, L.edSize + 1) }) }, { label: 'Smaller', run: () => setLayout({ edSize: Math.max(10, L.edSize - 1) }) }, { label: 'Reset', run: () => setLayout({ edSize: 14 }) }] },
            { sep: true },
            { label: 'Reset panel layout', run: resetLayout },
            { label: 'Full screen', hint: 'F11', run: () => api.windowAction('fullscreen') },
        ],
        Project: [
            { label: 'Build site', hint: 'Ctrl Shift B', run: runBuild },
            { label: 'Open preview', run: () => setView('preview') },
            { label: 'Site settings', run: () => setView('settings') },
            { label: 'Open in browser', run: () => guard(() => api.openPreview(previewPath)) },
            { label: 'Show project folder', run: () => guard(() => api.reveal()) },
            { sep: true },
            { label: 'New collection…', run: newCollectionFlow, disabled: !isMaster() },
            { label: 'Update engine…', run: updateEngineFlow, disabled: !isMaster() || S.P.engine === 'current' },
            { label: 'Reload project from disk', run: reloadFromDisk },
        ],
        Help: [
            { label: 'Keyboard shortcuts', hint: 'F1', run: helpShortcuts },
            { label: 'Template syntax', run: helpSyntax },
            { label: 'Developer tools', hint: 'F12', run: () => api.windowAction('devtools') },
            { sep: true },
            { label: 'About Coral Studio', run: helpAbout },
        ],
    };
}
function setupMenubar() {
    const bar = $('#menubar');
    bar.innerHTML = ['File', 'Edit', 'View', 'Project', 'Help'].map((n) => `<button data-menu="${n}" aria-haspopup="menu">${n}</button>`).join('');
    let openName = null;
    const openMenu = async (btn) => {
        const defs = await menuDefs();
        const r = btn.getBoundingClientRect();
        const name = btn.dataset.menu;
        $$('.menubar button').forEach((b) => b.classList.toggle('on', b === btn));
        PopMenu.open(defs[name], r.left, r.bottom + 2, { onClose: () => { if (openName === name) { openName = null; $$('.menubar button').forEach((b) => b.classList.remove('on')); } } });
        openName = name;
    };
    bar.addEventListener('click', (e) => { const b = e.target.closest('[data-menu]'); if (!b) return; if (openName === b.dataset.menu) PopMenu.close(); else openMenu(b); });
}

/* ---------- context menus ---------- */
function collectionOf(file, key) { return collections().find((c) => c.file === file && c.key === key); }
function sourceMenu(rel) {
    const protectedFile = rel === 'master.json';
    return [
        { label: 'Open', run: () => openProjectFile(rel) },
        { label: 'Rename…', run: () => renameSource(rel), disabled: protectedFile },
        { label: 'Duplicate', run: () => duplicateSource(rel), disabled: rel === 'master.json' },
        { sep: true },
        { label: 'Copy path', run: () => navigator.clipboard.writeText(rel).then(() => toast('Copied ' + rel)) },
        { label: 'Show in folder', run: () => guard(() => api.reveal(rel)) },
        ...(rel.startsWith('src/partials/') ? [{ label: 'Copy {{> include}} tag', run: () => navigator.clipboard.writeText(`{{> ${rel.replace(/^src\/partials\//, '').replace(/\.html$/, '')}}}`).then(() => toast('Copied')) }] : []),
        ...(rel.startsWith('src/pages/') ? [{ label: 'Preview built page', run: () => previewPage(rel.slice(10)) }] : []),
        { sep: true },
        { label: 'Delete', danger: true, run: () => deleteSource(rel), disabled: protectedFile },
    ];
}
async function renameSource(rel) {
    const v = await ask({ title: 'Rename file', fields: [{ name: 'to', label: 'New path', value: rel }], ok: 'Rename', validate: (v) => (/^[\w./-]+$/.test(v.to) && !v.to.includes('..') ? null : 'Keep the file inside this project and use letters, digits, dashes and dots.') });
    if (!v || v.to === rel) return;
    await guard(async () => {
        const open = S.tabs.find((x) => x.id === 'src:' + rel);
        if (open && open.dirty) { await api.writeText(rel, open.text); open.dirty = false; }
        await api.renameText(rel, v.to);
        if (open) { open.rel = v.to; open.id = 'src:' + v.to; }
        await refreshScan(); renderTabs();
    });
}
async function duplicateSource(rel) {
    await guard(async () => {
        const text = await api.readText(rel);
        const m = rel.match(/^(.*?)(\.[^./]+)$/);
        let to = `${m[1]}-copy${m[2]}`; for (let n = 2; (S.P.projectFiles || S.P.sources).some((f) => f.rel === to); n++) to = `${m[1]}-copy-${n}${m[2]}`;
        await api.createText(to, text); await refreshScan(); await openProjectFile(to);
    });
}
async function deleteSource(rel) {
    if (!(await confirmBox(`Delete ${rel.split('/').pop()}?`, 'The file goes to the Recycle Bin. Pages or templates that use it will fail to build.', 'Delete', true))) return;
    await guard(async () => {
        const i = S.tabs.findIndex((x) => x.id === 'src:' + rel);
        if (i >= 0) await closeTab(i, true);
        await api.deleteText(rel); await refreshScan(); renderEditor();
    });
}
function ctxMenuFor(ctx, target) {
    const [kind, ...r] = ctx.split(':'); const arg = r.join(':');
    if (kind === 'item') {
        const [file, key, i] = arg.split('|'); const c = collectionOf(file, key); if (!c) return null; const it = c.items[+i];
        return [
            { label: 'Open', run: () => openItem(file, key, it) },
            { label: 'Duplicate', run: () => duplicateItem(c, +i) },
            { label: 'Rename slug…', hint: 'F2', run: () => renameItem(c, +i) },
            { label: it.draft === true ? 'Publish (remove draft)' : 'Mark as draft', run: () => toggleDraft(c, +i) },
            { sep: true },
            { label: 'Copy page address', run: () => navigator.clipboard.writeText(itemUrl(c, it) || '').then(() => toast('Copied')), disabled: !itemUrl(c, it) },
            ...(itemUrl(c, it) ? [{ label: 'Preview built page', run: () => previewPage(itemUrl(c, it)) }] : []),
            ...(it.content ? [{ label: 'Show Markdown file', run: () => guard(() => api.reveal(it.content)) }] : []),
            { sep: true },
            { label: 'Delete', hint: 'Del', danger: true, run: () => deleteItem(c, +i) },
        ];
    }
    if (kind === 'src') return sourceMenu(arg);
    if (kind === 'region') return [
        { label: 'Open', run: () => openRegion(arg) },
        { label: 'Add override for a page…', run: async () => { await openRegion(arg); const t = cur(); if (t) switchScope(t, '__add'); } },
        { label: 'Copy {{region}} tag', run: () => navigator.clipboard.writeText(`{{region:${arg}}}`).then(() => toast('Copied')) },
    ];
    if (kind === 'block') return [{ label: 'Open', run: () => openBlock(arg) }, { label: 'Copy {{md}} tag', run: () => navigator.clipboard.writeText(`{{md:${arg}}}`).then(() => toast('Copied')) }];
    if (kind === 'settings') return [{ label: 'Open', run: () => openSettings(arg) }];
    if (kind === 'group') {
        const items = [];
        if (arg.startsWith('c:')) { const c = collections().find((x) => x.name === arg.slice(2)); if (c) items.push({ label: `New item in ${c.label}…`, run: () => addItem(c) }, { sep: true }); }
        else if (arg === 'pages') items.push({ label: 'New HTML page…', run: newHtmlPageFlow }, { sep: true });
        else if (arg === 'regions' && isMaster()) items.push({ label: 'New region…', run: newRegionFlow }, { sep: true });
        else if (arg === 'tpl' || arg === 'assets' || arg === 'other') items.push({ label: 'New file…', run: newFileFlow }, { sep: true });
        items.push({ label: S.L.collapsed[arg] ? 'Expand' : 'Collapse', run: () => toggleGroup(arg) }, { label: 'Collapse all', run: () => setCollapsedAll(true) }, { label: 'Expand all', run: () => setCollapsedAll(false) });
        return items;
    }
    if (kind === 'tab') {
        const i = +arg, t = S.tabs[i]; if (!t) return null;
        return [
            { label: 'Close', hint: 'Ctrl W', run: () => closeTab(i) },
            { label: 'Close others', run: () => closeMany((x) => x === t), disabled: S.tabs.length < 2 },
            { label: 'Close to the right', run: () => closeMany((x, j) => j <= i), disabled: i >= S.tabs.length - 1 },
            { label: 'Close all', run: () => closeMany(() => false) },
            { sep: true },
            { label: 'Save', hint: 'Ctrl S', run: () => guard(async () => { await saveTab(t); renderTabs(); renderExplorer(); renderStatus(); toast('Saved'); }), disabled: !tabDirty(t) },
        ];
    }
    if (kind === 'media') return [
        { label: 'Copy file name', run: () => navigator.clipboard.writeText(arg).then(() => toast('Copied ' + arg)) },
        { label: 'Copy as Markdown image', run: () => navigator.clipboard.writeText(`![](assets/img/${arg})`).then(() => toast('Copied')) },
        { sep: true },
        { label: 'Delete image', danger: true, run: async () => { if (await confirmBox(`Delete ${arg}?`, 'The image goes to the Recycle Bin.', 'Delete', true)) guard(async () => { S.P.media = await api.deleteMedia(arg); renderMedia(); renderAll(); }); } },
    ];
    return null;
}
function editMenu() {
    return [
        { label: 'Undo', hint: 'Ctrl Z', run: () => editExec('undo') }, { label: 'Redo', hint: 'Ctrl Y', run: () => editExec('redo') }, { sep: true },
        { label: 'Cut', hint: 'Ctrl X', run: () => editExec('cut') }, { label: 'Copy', hint: 'Ctrl C', run: () => editExec('copy') }, { label: 'Paste', hint: 'Ctrl V', run: () => editExec('paste') }, { label: 'Select all', hint: 'Ctrl A', run: () => editExec('selectAll') },
    ];
}
function toggleGroup(id) { S.L.collapsed[id] = !S.L.collapsed[id]; saveLayout(); renderExplorer(); }
function setCollapsedAll(v) {
    const ids = $$('[data-gh]').map((g) => g.dataset.gh);
    S.L.collapsed = v ? Object.fromEntries(ids.map((i) => [i, true])) : {};
    saveLayout(); renderExplorer();
}

/* ---------- command palette ---------- */
function openPalette() {
    if (!S.P) return;
    const ov = $('#overlay');
    ov.hidden = false;
    const cmds = [
        { t: 'Build site', h: 'Ctrl Shift B', run: runBuild },
        { t: 'Toggle PowerShell terminal', h: 'Ctrl J', run: () => toggleTerminal() },
        { t: 'Toggle developer tools', h: 'F12', run: () => api.windowAction('devtools') },
        { t: 'Save all', h: 'Ctrl Shift S', run: () => guard(async () => { await saveAll(); toast('All saved'); }) },
        { t: 'Go to Dashboard', h: 'Alt 1', run: () => setView('dashboard') },
        { t: 'Go to Media library', h: 'Alt 3', run: () => setView('media') },
        { t: 'Go to Preview', h: 'Alt 4', run: () => setView('preview') },
        { t: 'Go to Site settings', run: () => setView('settings') },
        { t: 'Toggle sidebar', h: 'Ctrl B', run: () => setLayout({ expOpen: !S.L.expOpen }) },
        { t: 'Toggle live preview pane', h: 'Ctrl \\', run: () => setLayout({ previewOpen: !S.L.previewOpen }) },
        { t: 'Toggle focus mode', h: 'Ctrl .', run: () => setLayout({ focus: !S.L.focus }) },
        { t: 'Reset panel layout', run: resetLayout },
        { t: 'Zoom in', h: 'Ctrl +', run: () => zoom('in') }, { t: 'Zoom out', h: 'Ctrl −', run: () => zoom('out') }, { t: 'Reset zoom', h: 'Ctrl 0', run: () => zoom('reset') },
        { t: 'New HTML page…', run: newHtmlPageFlow },
        { t: 'New collection…', run: newCollectionFlow },
        { t: 'New region…', run: newRegionFlow },
        { t: 'Keyboard shortcuts', h: 'F1', run: helpShortcuts },
        { t: 'Template syntax', run: helpSyntax },
        { t: 'Show project folder', run: () => guard(() => api.reveal()) },
        { t: 'Open another project', run: () => closeProject() },
    ];
    for (const c of collections()) {
        cmds.push({ t: `New item in ${c.label}…`, h: 'new', run: () => addItem(c) });
        c.items.forEach((it) => cmds.push({ t: titleOf(it), h: c.label, run: () => openItem(c.file, c.key, it) }));
    }
    for (const f of S.P.sources) cmds.push({ t: f.rel.replace(/^src\//, ''), h: 'file', run: () => openSource(f.rel) });
    for (const r of S.P.regions) cmds.push({ t: r.name, h: 'region', run: () => openRegion(r.name) });
    for (const r of S.P.includes) cmds.push({ t: r.name, h: 'markdown block', run: () => openBlock(r.name) });
    for (const f of settingsFiles()) cmds.push({ t: f, h: 'settings', run: () => openSettings(f) });
    ov.innerHTML = '<div class="palette"><input id="p-in" placeholder="Type a page, file, region, setting or command" autocomplete="off"><div class="list" id="p-list"></div></div>';
    const inp = $('#p-in'), list = $('#p-list');
    let shown = [], sel = 0;
    const draw = () => {
        const words = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        shown = cmds.filter((c) => { const hay = (c.t + ' ' + (c.h || '')).toLowerCase(); return words.every((w) => hay.includes(w)); }).slice(0, 60);
        sel = Math.min(sel, Math.max(shown.length - 1, 0));
        list.innerHTML = shown.map((c, i) => `<div class="it${i === sel ? ' on' : ''}" data-i="${i}"><span>${esc(c.t)}</span><small>${esc(c.h || '')}</small></div>`).join('') || '<div class="it"><small>No matches</small></div>';
        const on = $('.it.on', list); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const close = () => { ov.hidden = true; ov.innerHTML = ''; };
    const run = (i) => { const c = shown[i]; close(); if (c) setTimeout(c.run, 0); };
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); draw(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
        else if (e.key === 'Enter') run(sel);
    });
    list.onclick = (e) => { const it = e.target.closest('.it[data-i]'); if (it) run(+it.dataset.i); };
    ov.onmousedown = (e) => { if (e.target === ov) close(); };
    draw(); inp.focus();
}

/* ---------- events ---------- */
async function handleDelete(spec) {
    const [kind, ...r] = spec.split(':'); const arg = r.join(':');
    if (kind === 'item') { const [f, k, i] = arg.split('|'); const c = collectionOf(f, k); if (c) await deleteItem(c, +i); }
    else if (kind === 'src') await deleteSource(arg);
}
function openRowByData(el) {
    const k = el.dataset.k, a = el.dataset.a;
    if (window.innerWidth <= 820) setLayout({ expOpen: false }); // small window: the floating explorer closes after a choice
    if (k === 'item') { const [f, key, i] = a.split('|'); const c = collectionOf(f, key); if (c) openItem(f, key, c.items[+i]); }
    else if (k === 'src') openSource(a);
    else if (k === 'region') openRegion(a);
    else if (k === 'block') openBlock(a);
    else if (k === 'settings') openSettings(a);
}
async function importMediaFlow() {
    $('#overlay').hidden = false;
    $('#overlay').innerHTML = `<form class="modal media-import-modal" role="dialog" aria-modal="true" aria-label="Import media">
        <h3>Import media</h3>
        <div class="media-import-row"><label for="media-source">Image or video</label><div class="media-import-picker"><input id="media-source" type="text" readonly placeholder="Choose a file…"><button type="button" data-pick-media-file title="Choose image or video" aria-label="Choose image or video">${icon('folder')}</button></div></div>
        <div class="media-import-row"><label for="media-destination">Destination folder in project</label><div class="media-import-picker"><input id="media-destination" type="text" readonly value="src/assets/img"><button type="button" data-pick-media-folder title="Choose destination folder" aria-label="Choose destination folder">${icon('folder')}</button></div></div>
        <div class="err" role="alert"></div><div class="btns"><button type="button" id="m-cancel">Cancel</button><button type="submit" class="primary">Import</button></div></form>`;
    const ov = $('#overlay'), form = $('form', ov);
    const close = () => { ov.hidden = true; ov.innerHTML = ''; };
    $('#m-cancel').onclick = close;
    ov.onmousedown = (e) => { if (e.target === ov) close(); };
    form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    $('[data-pick-media-file]', form).onclick = async () => {
        const file = await guard(() => api.pickMediaFile());
        if (file) $('#media-source').value = file;
    };
    $('[data-pick-media-folder]', form).onclick = async () => {
        const folder = await guard(() => api.pickMediaFolder());
        if (folder != null && folder !== '') $('#media-destination').value = folder;
    };
    form.onsubmit = async (e) => {
        e.preventDefault();
        const source = $('#media-source').value;
        const destination = $('#media-destination').value;
        if (!source) { $('.err', form).textContent = 'Choose an image or video first.'; return; }
        const result = await guard(async () => api.importMedia(source, destination));
        if (!result) return;
        S.P.media = result; S.mediaViewer = null; close(); renderMedia(); renderExplorer(); toast('Media imported');
    };
}
async function newPageFlow() {
    const values = await ask({
        title: 'New HTML page',
        text: 'Create a page layout and its configuration file.',
        fields: [
            { name: 'name', label: 'Page name', placeholder: 'about' },
            { name: 'markdown', label: 'Include Markdown content file', type: 'checkbox', value: false },
        ],
        ok: 'Create',
        validate: (v) => (/^[\p{L}\p{N}_-]+$/u.test(v.name) ? null : 'Use letters, numbers, dashes or underscores.'),
    });
    if (!values) return;
    await guard(async () => {
        const files = await api.createPageFiles(values.name, values.markdown);
        await refreshScan();
        await openProjectFile(files[0]);
        toast(`Created ${files.length} page files`);
    });
}
function doAdd(spec) {
    if (spec.startsWith('item:')) { const c = collections().find((x) => x.name === spec.slice(5)); return c && addItem(c); }
    return { htmlpage: newHtmlPageFlow, region: newRegionFlow, collection: newCollectionFlow, tplfile: newFileFlow, assetfile: newFileFlow }[spec]?.();
}
document.addEventListener('click', async (e) => {
    const g = (sel) => e.target.closest(sel);
    let el;
    if ((el = g('[data-app-tab]'))) { S.appSettingsTab = el.dataset.appTab; return renderAppSettings(); }
    if ((el = g('[data-code-action]'))) return sourceCodeAction(el.dataset.codeAction);
    if ((el = g('[data-code-search]'))) return sourceCodeSearch(el.dataset.codeSearch);
    if ((el = g('[data-terminal-action]'))) {
        const action = el.dataset.terminalAction;
        if (action === 'hide') return toggleTerminal(false);
        if (action === 'clear') { $('#terminal-output').replaceChildren(); terminalAppend('PowerShell output cleared.\n', 'info'); return; }
        if (action === 'stop') { stopTerminalSession(); terminalAppend('PowerShell session stopped.\n', 'info'); return; }
        if (action === 'restart') return restartTerminalSession();
    }
    if ((el = g('[data-add]'))) { e.stopPropagation(); return doAdd(el.dataset.add); }
    if ((el = g('[data-del]'))) { e.stopPropagation(); return handleDelete(el.dataset.del); }
    if ((el = g('[data-forget]'))) { e.stopPropagation(); return guard(async () => { S.recentProjects = await api.forgetRecent(el.dataset.forget); if (!S.P) renderDashboard(); toast('Removed from recent projects'); }); }
    if ((el = g('[data-view]'))) return setView(el.dataset.view);
    if ((el = g('[data-tree-toggle]'))) {
        const key = 'tree:' + el.dataset.treeToggle;
        S.L.collapsed[key] = !S.L.collapsed[key]; saveLayout(); return renderExplorer();
    }
    if ((el = g('[data-media-open]'))) {
        S.mediaViewer = S.P.media.find((m) => m.name === el.dataset.mediaOpen) || null;
        if (S.view !== 'media') setView('media'); else renderMedia();
        return;
    }
    if ((el = g('[data-project-file]'))) return openProjectFile(el.dataset.projectFile);
    if ((el = g('[data-act]'))) {
        const a = el.dataset.act;
        if (a === 'build') return runBuild();
        if (a === 'new-file') return newFileFlow();
        if (a === 'new-page') return newPageFlow();
        if (a === 'save-current') return saveCurrent();
        if (a === 'save-all') return guard(async () => { await saveAll(); toast('All saved'); });
        if (a === 'new-project') return newProjectFlow();
        if (a === 'open-project') return openProjectFlow();
        if (a === 'app-settings') return openAppSettingsFlow();
        if (a === 'save-site-settings') return SiteSettingsView.save();
        if (a === 'app-save-settings') return saveAppSettings();
        if (a === 'app-reset-layout') return resetLayout();
        if (a === 'terminal') return toggleTerminal();
        if (a === 'devtools') return api.windowAction('devtools');
        if (a === 'window-minimize') return api.windowAction('minimize');
        if (a === 'window-maximize') return api.windowAction('maximize');
        if (a === 'window-close') return api.windowAction('close');
        if (a === 'open-site-json') return openSettings('site.json');
        if (a === 'folder') return guard(() => api.reveal());
        if (a === 'import') return importMediaFlow();
        if (a === 'media-close') { S.mediaViewer = null; return renderMedia(); }
        if (a === 'pv-reload') { previewPath = $('#pv-path').value || 'index.html'; return reloadPreview(); }
        if (a === 'pv-ext') return guard(() => api.openPreview($('#pv-path').value));
        if (a === 'toggle-sidebar') { setLayout({ expOpen: !S.L.expOpen }); renderToolbar(); return; }
        if (a === 'toggle-fields') return setLayout({ fieldsOpen: !S.L.fieldsOpen });
        if (a === 'toggle-preview') return setLayout({ previewOpen: !S.L.previewOpen });
        if (a === 'toggle-focus') return setLayout({ focus: !S.L.focus });
        if (a === 'update-engine') return updateEngineFlow();
        if (a === 'zoom-reset') return zoom('reset');
        if (a === 'help-syntax') return helpSyntax();
        if (a === 'open-built') { const t = cur(); return previewPage(t.rel.slice(10)); }
        if (a === 'format-json') { const t = cur(); try { t.text = JSON.stringify(JSON.parse(t.text), null, 2) + '\n'; markTabDirty(t); renderEditor(); } catch (err) { toast('Not valid JSON: ' + err.message); } return; }
        if (a === 'addfield') {
            const t = cur(); if (!t) return;
            const v = await ask({ title: 'Add field', text: t.kind === 'item' ? 'The field is added to this entry only.' : 'The field is added to this file.', fields: [{ name: 'name', label: 'Field name', placeholder: 'author' }, { name: 'type', label: 'Type', type: 'select', value: 'text', options: FIELD_TYPES }], ok: 'Add', validate: (v) => (/^[\w-]+$/.test(v.name) ? (v.name in objectFor(t) ? 'That field already exists.' : null) : 'Use letters, numbers, dashes and underscores.') });
            if (!v) return;
            objectFor(t)[v.name] = { bool: false, number: 0, list: [] }[v.type] ?? '';
            markDirty(t.file); return renderEditor();
        }
    }
    if ((el = g('[data-pvw]'))) { previewWidth = +el.dataset.pvw; applyPreviewWidth(); $$('[data-pvw]').forEach((b) => b.classList.toggle('on', +b.dataset.pvw === previewWidth)); return; }
    if ((el = g('[data-pane]')) && el.tagName === 'BUTTON') return setPane(el.dataset.pane);
    if ((el = g('[data-set-mode]'))) { const t = cur(); t.raw = el.dataset.setMode === 'raw'; return renderEditor(); }
    if ((el = g('[data-open-src]'))) return openSource(el.dataset.openSrc);
    if ((el = g('[data-md-menu]'))) { const r = el.getBoundingClientRect(); return insertMenu(r.left, r.bottom + 2); }
    if ((el = g('[data-copy]'))) { navigator.clipboard.writeText(el.dataset.copy).then(() => toast('Copied ' + el.dataset.copy)); return; }
    if ((el = g('[data-md]'))) return mdAction($('#md'), el.dataset.md);
    if ((el = g('[data-close]'))) { e.stopPropagation(); return closeTab(+el.dataset.close); }
    if ((el = g('[data-tab]'))) { S.active = +el.dataset.tab; renderEditor(); renderExplorer(); renderStatus(); return; }
    if ((el = g('[data-gh]'))) return toggleGroup(el.dataset.gh);
    if ((el = g('[data-k]')) && el.classList.contains('row')) return openRowByData(el);
    if ((el = g('[data-open-col]'))) { S.L.collapsed['c:' + el.dataset.openCol] = false; setLayout({ expOpen: true }); renderExplorer(); return; }
    if ((el = g('[data-gh-open]'))) { S.L.collapsed[el.dataset.ghOpen] = false; setLayout({ expOpen: true }); renderExplorer(); return; }
    if ((el = g('.recent'))) return openProjectFlow(el.dataset.dir);
    if (g('#build-btn')) return runBuild();
    if (g('#open-palette')) return openPalette();
    if (g('#ex-new')) return newFileFlow();
});
document.addEventListener('contextmenu', (e) => {
    if (!S.P || $('#app').hidden) return;
    e.preventDefault();
    const c = e.target.closest('[data-ctx]');
    let items = c ? ctxMenuFor(c.dataset.ctx, c) : null;
    if (!items && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) items = editMenu();
    if (items) PopMenu.open(items, e.clientX, e.clientY);
});
document.addEventListener('dblclick', (e) => { const t = e.target.closest('.tab'); if (t) setLayout({ focus: !S.L.focus }); });

document.addEventListener('input', (e) => {
    const el = e.target; const t = cur();
    if (el.id === 'ex-filter') { S.filter = el.value; renderExplorer(); return; }
    if (el.id === 'code-find') { updateCodeSearchCount(); return; }
    if (el.id === 'app-font-size') { $('#app-font-value').textContent = `${el.value}px`; document.documentElement.style.setProperty('--ed-size', `${el.value}px`); if (monacoCodeEditor) monacoCodeEditor.updateOptions({ fontSize: Number(el.value) }); return; }
    if (el.id === 'app-side-width') { $('#app-side-value').textContent = `${el.value}px`; document.documentElement.style.setProperty('--exp-w', `${el.value}px`); return; }
    if (el.id === 'app-terminal-height') { $('#app-terminal-value').textContent = `${el.value}px`; document.documentElement.style.setProperty('--terminal-h', `${el.value}px`); return; }
    if (!t) return;
    if (el.id === 'md') {
        t.md = el.value; t.mdDirty = true; renderTabs(); renderStatus(); schedulePreview();
        if (t.kind === 'item') { const row = $('.row.on'); if (row && !row.classList.contains('unsaved')) renderExplorer(); }
        return;
    }
    if (el.id === 'code') {
        syncCodeEditorFromBuffer(el);
        t.text = el.value; if (!t.dirty) { t.dirty = true; renderTabs(); renderExplorer(); }
        if (/\.json$/i.test(t.rel)) { try { JSON.parse(el.value); $('#monaco-editor')?.classList.remove('bad'); } catch (err) { $('#monaco-editor')?.classList.add('bad'); } }
        const meta = $('.source-file-meta'); if (meta) meta.textContent = `${t.rel} · ${el.value.split('\n').length} lines`;
        updateCodeSearchCount();
        codePos(el); scheduleAppAutoSave(t); return;
    }
    if (el.id === 'rawjson') {
        try {
            const v = JSON.parse(el.value); el.classList.remove('bad');
            const o = S.P.files[t.file]; for (const k of Object.keys(o)) delete o[k]; Object.assign(o, v); markDirty(t.file);
        } catch (err) { el.classList.add('bad'); }
        return;
    }
    if (!el.dataset || !el.dataset.k) return;
    const obj = objectFor(t); const k = el.dataset.k; let v;
    if (el.dataset.t === 'b') v = el.checked;
    else if (el.dataset.t === 'n') v = el.value === '' ? 0 : Number(el.value);
    else if (el.dataset.t === 'j') { try { v = JSON.parse(el.value); el.classList.remove('bad'); } catch (err) { el.classList.add('bad'); return; } }
    else v = el.value;
    setPath(obj, k, v); markDirty(t.file);
    if (el.type === 'color') { const tx = el.parentElement.querySelector('input[type=text]'); if (tx) tx.value = v; }
    else if (el.type === 'text') { const sw = el.parentElement.querySelector('input[type=color]'); if (sw && /^#[0-9a-f]{6}$/i.test(v)) sw.value = v; }
    if (t.kind === 'item' && (k === 'title' || k === 'name')) { const h = $('#doc-title'); if (h) h.textContent = titleOf(t.item); renderTabs(); renderExplorer(); }
});
document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'terminal-profile') { if (S.terminalOpen) restartTerminalSession(); return; }
    if (el.closest('#v-app-settings') && el.id !== 'app-font-size') {
        if (el.id === 'app-auto-save') $('#app-save-delay').disabled = !el.checked;
        saveAppSettings(true); return;
    }
    if (el.id === 'app-font-size') { saveAppSettings(true); return; }
    if (el.dataset && el.dataset.t === 'b') el.dispatchEvent(new Event('input', { bubbles: true }));
    if (el.id === 'scope') { const t = cur(); if (t) switchScope(t, el.value); }
});
document.addEventListener('wheel', (e) => {
    const stage = e.target.closest('[data-media-stage].zoomable');
    if (!stage || !S.mediaViewer || S.mediaViewer.type !== 'image') return;
    e.preventDefault();
    const img = stage.querySelector('[data-media-image]');
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const oldZoom = S.mediaZoom || 1;
    const nextZoom = Math.max(0.25, Math.min(8, oldZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    if (nextZoom === oldZoom) return;
    const ratio = nextZoom / oldZoom;
    const px = e.clientX - (rect.left + rect.width / 2);
    const py = e.clientY - (rect.top + rect.height / 2);
    img.style.transformOrigin = `${50 + (px / rect.width) * 100}% ${50 + (py / rect.height) * 100}%`;
    setMediaZoom(nextZoom);
}, { passive: false });
document.addEventListener('dblclick', (e) => {
    if (e.target.matches('[data-media-image]')) { e.preventDefault(); setMediaZoom(1); e.target.style.transformOrigin = 'center'; }
});
document.addEventListener('keyup', (e) => { if (e.target.id === 'code') { codePos(e.target); updateCodeSearchCount(); } });
document.addEventListener('mouseup', (e) => { if (e.target.id === 'code') { codePos(e.target); updateCodeSearchCount(); } });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.mediaViewer) { S.mediaViewer = null; if (S.view === 'media') renderMedia(); return; }
    if (e.target.id === 'code-find' && e.key === 'Enter') { e.preventDefault(); sourceCodeSearch(e.shiftKey ? 'previous' : 'next'); return; }
    if (e.target.id === 'code-find' && e.key === 'Escape') { e.preventDefault(); sourceCodeSearch('close'); return; }
    if (e.target.closest('#code-searchbar') && e.key === 'Escape' && !$('#code-searchbar')?.hidden) { sourceCodeSearch('close'); return; }
    if (e.key === 'F3' && $('#code-searchbar') && !$('#code-searchbar').hidden) { e.preventDefault(); sourceCodeSearch(e.shiftKey ? 'previous' : 'next'); return; }
    if (e.target.id === 'code' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); sourceCodeAction('goto'); return; }
    if (e.target.id === 'code' && (e.ctrlKey || e.metaKey) && ['f', 'h'].includes(e.key.toLowerCase())) { e.preventDefault(); openCodeSearch(e.key.toLowerCase() === 'h'); return; }
    if (e.target.id === 'code' && codeKey(e, e.target)) return;
    if (e.target.id === 'md' && e.key === 'Tab' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.target.setRangeText('  ', e.target.selectionStart, e.target.selectionEnd, 'end'); e.target.dispatchEvent(new Event('input', { bubbles: true })); return; }
    if (e.target.id === 'md' && (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'b' || e.key === 'i')) { e.preventDefault(); mdAction(e.target, e.key); return; }
    if (e.target.id === 'pv-path' && e.key === 'Enter') { previewPath = e.target.value || 'index.html'; reloadPreview(); return; }
    if (e.target.id === 'terminal-input') {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTerminalCommand(); return; }
        if (e.key === 'ArrowUp' && e.target.selectionStart === 0 && S.terminalHistory.length) { e.preventDefault(); S.terminalHistoryIndex = Math.max(0, S.terminalHistoryIndex - 1); e.target.value = S.terminalHistory[S.terminalHistoryIndex]; e.target.setSelectionRange(0, 0); e.target.dispatchEvent(new Event('input', { bubbles: true })); return; }
        if (e.key === 'ArrowDown' && e.target.selectionEnd === e.target.value.length && S.terminalHistory.length) { e.preventDefault(); S.terminalHistoryIndex = Math.min(S.terminalHistory.length, S.terminalHistoryIndex + 1); e.target.value = S.terminalHistory[S.terminalHistoryIndex] || ''; e.target.setSelectionRange(e.target.value.length, e.target.value.length); e.target.dispatchEvent(new Event('input', { bubbles: true })); return; }
    }
    if (e.target.classList && e.target.classList.contains('row')) {
        const row = e.target;
        if (e.key === 'Enter') return row.click();
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const rows = $$('#explorer .row'); const n = rows[rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); return e.preventDefault(); }
        if (e.key === 'Delete') return handleDelete(row.dataset.ctx);
        if (e.key === 'F2') { const [kind, ...r] = row.dataset.ctx.split(':'); if (kind === 'item') { const [f, k, i] = r.join(':').split('|'); const c = collectionOf(f, k); if (c) renameItem(c, +i); } else if (kind === 'src') renameSource(r.join(':')); return; }
        if (e.key === 'ContextMenu') { const b = row.getBoundingClientRect(); const items = ctxMenuFor(row.dataset.ctx, row); if (items) PopMenu.open(items, b.left + 20, b.bottom); return; }
    }
    if (e.target.classList && e.target.classList.contains('tree-file')) {
        const file = e.target.dataset.projectFile;
        if (e.key === 'Enter') { e.preventDefault(); return openProjectFile(file); }
        if (e.key === 'F2') { e.preventDefault(); return renameSource(file); }
        if (e.key === 'Delete') { e.preventDefault(); return handleDelete(`src:${file}`); }
    }
    if (!S.P || $('#app').hidden) return;
    if (e.key === 'F1') { e.preventDefault(); return helpShortcuts(); }
    if (e.altKey && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        return setView(['dashboard', 'editor', 'media', 'preview'][+e.key - 1]);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && S.tabs.length > 1 && S.view === 'editor') {
        e.preventDefault();
        const n = (S.active + (e.shiftKey ? -1 : 1) + S.tabs.length) % S.tabs.length;
        return showTab(n);
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'k' || (k === 'p' && !e.shiftKey)) { e.preventDefault(); openPalette(); }
    else if (k === 's' && e.shiftKey) { e.preventDefault(); guard(async () => { await saveAll(); toast('All saved'); }); }
    else if (k === 's') { e.preventDefault(); if (S.view === 'settings') SiteSettingsView.save(); else if (S.view === 'app-settings') saveAppSettings(); else if (S.view === 'markdown') MarkdownEditor.save(); else if (S.view === 'config') ConfigView.save(); else saveCurrent(); }
    else if (k === 'b' && e.shiftKey) { e.preventDefault(); runBuild(); }
    else if (k === 'b' && e.altKey) { e.preventDefault(); setLayout({ fieldsOpen: !S.L.fieldsOpen }); }
    else if (k === 'b') { e.preventDefault(); setLayout({ expOpen: !S.L.expOpen }); }
    else if (k === 'j') { e.preventDefault(); toggleTerminal(); }
    else if (k === '\\') { e.preventDefault(); setLayout({ previewOpen: !S.L.previewOpen }); }
    else if (k === '.') { e.preventDefault(); setLayout({ focus: !S.L.focus }); }
    else if (k === 'w' && S.tabs.length && S.view === 'editor') { e.preventDefault(); closeTab(S.active); }
});

document.addEventListener('submit', (e) => { if (e.target.id === 'terminal-form') { e.preventDefault(); submitTerminalCommand(); } });
document.addEventListener('input', (e) => {
    if (e.target.id !== 'terminal-input') return;
    e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 130)}px`;
});

/* ---------- boot ---------- */
function setupSplitters() {
    splitter($('#split-exp'), { axis: 'x', get: () => S.L.expW, set: (v) => setLayout({ expW: v }), min: 180, max: maxW(0.5), dir: 1, reset: () => setLayout({ expW: LAYOUT_DEFAULTS.expW }) });
    splitter($('#split-terminal'), { axis: 'y', get: () => S.L.terminalH, set: (v) => setLayout({ terminalH: v }), min: 120, max: () => Math.floor(window.innerHeight * 0.65), dir: -1, reset: () => setLayout({ terminalH: LAYOUT_DEFAULTS.terminalH }) });
}
api.onZoomKey((what) => zoom(what));
api.onTerminalData((data) => {
    if (S.terminalSession && data.sessionId !== S.terminalSession) return;
    if (!S.terminalSession && !S.terminalStartPromise) return;
    terminalAppend(data.text, data.stream);
});
api.onTerminalError((data) => {
    if (S.terminalSession && data.sessionId !== S.terminalSession) return;
    if (!S.terminalSession && !S.terminalStartPromise) return;
    S.terminalSession = null; $('.terminal-indicator')?.classList.add('off'); terminalAppend(`${data.message}\n`, 'stderr');
});
api.onTerminalExit((data) => {
    if (S.terminalSession && data.sessionId !== S.terminalSession) return;
    if (!S.terminalSession && !S.terminalStartPromise) return;
    S.terminalSession = null; $('.terminal-indicator')?.classList.add('off');
    terminalAppend(`PowerShell exited${data.code == null ? '' : ` with code ${data.code}`}\n`, 'info');
});
api.onCloseRequest(async () => {
    if (!anyDirty()) return api.quit();
    const r = await ask({ title: 'Quit with unsaved changes?', text: 'Save everything first, or quit and lose the changes.', ok: 'Save and quit' });
    if (r) { try { await saveAll(); } catch (err) { return toast(err.message); } api.quit(); }
});
window.addEventListener('resize', () => { updateDocMode(); const m = Math.floor(window.innerWidth * 0.5); if (S.L.expW > m) setLayout({ expW: Math.max(180, m) }); });
$('#proj-name').textContent = 'Coral Studio';
setupMenubar();
setupSplitters();
if (window.ResizeObserver) new ResizeObserver(() => updateDocMode()).observe($('#editor-body'));
applyLayout();
applyAppPreferences();
showWelcome();
