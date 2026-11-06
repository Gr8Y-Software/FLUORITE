'use strict';
/* Master SSG studio: project shell, explorer, dashboard, media and preview.
   editors/ contains the code, Markdown and JSON workspaces. */
const api = window.ssg;
$('#window-controls').hidden = api.platform === 'darwin';
const APP_PREF_DEFAULTS = { theme: 'dark', accent: '#9b8cff', wrap: false, autoSave: false, autoSaveDelay: 1000 };

const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    editor: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    markdown: '<path d="M4 5h16v14H4z"/><path d="M7 15V9l2 2 2-2v6M15 12h2m-1-3v6"/>',
    structure: '<path d="M12 4v5M6 20v-5m12 5v-5M12 9H6v6m6-6h6v6"/><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="3" y="18" width="6" height="4" rx="1"/><rect x="15" y="18" width="6" height="4" rx="1"/><rect x="9" y="13" width="6" height="4" rx="1"/>',
    config: '<path d="M5 3h11l4 4v14H5z"/><path d="M8 3v6h8V3M8 14h8M8 18h5"/>',
    media: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>',
    preview: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    terminal: '<path d="m4 6 6 6-6 6M13 18h7"/>',
    devtools: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/><path d="m14 13 2 2-2 2"/>',
    folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
    settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--bg0)"/><circle cx="15" cy="12" r="2" fill="var(--bg0)"/><circle cx="11" cy="18" r="2" fill="var(--bg0)"/>',
    appSettings: '<path d="M12 3.2 14 4l.5 1.8 1.6.9 1.8-.5 1.2 1.9-1.1 1.5v1.8l1.1 1.5-1.2 1.9-1.8-.5-1.6.9L14 17l-2 .8-2-.8-.5-1.8-1.6-.9-1.8.5-1.2-1.9L6 11.4V9.6L4.9 8.1l1.2-1.9 1.8.5 1.6-.9L10 4z"/><circle cx="12" cy="10.5" r="2.5"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    save: '<path d="M5 3h12l4 4v14H3V3h2z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
    saveAll: '<path d="M4 3h11l5 5v13H4z"/><path d="M7 3v6h9V3M7 21v-8h9v8M2 6v15h15"/>',
    import: '<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 17v4h16v-4"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2"/>',
    external: '<path d="M13 5h6v6M19 5l-9 9"/><path d="M18 13v6H5V6h6"/>',
    build: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    tablet: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M11 18.5h2"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    fit: '<rect x="3" y="4" width="18" height="15" rx="2"/><path d="M8 22h8M12 19v3"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24">${ICONS[n]}</svg>`;
const gem = (size, id) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9b8cff"/><stop offset="1" stop-color="#46d6b8"/></linearGradient></defs><path d="M16 2l11 9-11 19L5 11z" fill="url(#g${id})"/><path d="M5 11h22M16 2l-5 9 5 19 5-19z" fill="none" stroke="#101218" stroke-opacity=".45" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

const S = {
    P: null, view: 'editor', tabs: [], active: -1, dirtyFiles: new Set(),
    build: { state: 'idle', ms: 0, code: 0 }, filter: '', zoom: 1,
    terminalOpen: false, terminalSession: null, terminalStartPromise: null, terminalHistory: [], terminalHistoryIndex: -1,
    appPrefs: Object.assign({}, APP_PREF_DEFAULTS, store.get('app-preferences', {})), appSettingsTab: 'General',
    L: Object.assign({ expW: 272, terminalH: 260, expOpen: true, fieldsW: 320, fieldsOpen: true, pvW: 460, previewOpen: true, focus: false, edSize: 14, collapsed: {} }, store.get('layout', {})),
};
const LAYOUT_DEFAULTS = { expW: 272, terminalH: 260, fieldsW: 320, pvW: 460 };
const saveLayout = debounce(() => store.set('layout', S.L), 250);
let appAutoSaveTimer = 0;
function scheduleAppAutoSave(t) {
    if (!S.appPrefs.autoSave || !t || t.kind !== 'text') return;
    clearTimeout(appAutoSaveTimer);
    appAutoSaveTimer = setTimeout(async () => {
        if (!S.tabs.includes(t) || !t.dirty) return;
        try { await saveTab(t); renderTabs(); renderExplorer(); renderStatus(); }
        catch (e) { toast(`Auto-save failed: ${e.message}`); }
    }, Math.max(300, Number(S.appPrefs.autoSaveDelay) || 1000));
}

/* ---------- layout (panel sizes live in CSS variables) ---------- */
function applyLayout() {
    const r = document.documentElement.style, L = S.L;
    r.setProperty('--exp-w', L.expW + 'px'); r.setProperty('--terminal-h', L.terminalH + 'px');
    r.setProperty('--fields-w', L.fieldsW + 'px'); r.setProperty('--pv-w', L.pvW + 'px'); r.setProperty('--ed-size', L.edSize + 'px');
    $('#app').classList.toggle('no-exp', !L.expOpen);
    $('#split-terminal').hidden = !S.terminalOpen;
    $('#terminal').hidden = !S.terminalOpen;
    if (typeof updateDocMode === 'function') updateDocMode();
}
function applyAppPreferences() {
    const root = document.documentElement;
    root.dataset.appTheme = S.appPrefs.theme === 'light' ? 'light' : 'dark';
    root.style.setProperty('--accent', S.appPrefs.accent || APP_PREF_DEFAULTS.accent);
    updateMonacoTheme();
}
function setLayout(patch) { Object.assign(S.L, patch); applyLayout(); saveLayout(); }
function resetLayout() { setLayout({ ...LAYOUT_DEFAULTS, expOpen: true, fieldsOpen: true, previewOpen: true, focus: false }); toast('Layout reset'); if (S.view === 'app-settings' && S.appSettingsTab === 'Workspace') renderAppSettings(); }
const maxW = (frac) => () => Math.floor(window.innerWidth * frac);

/* ---------- data model ---------- */
const isMaster = () => S.P.kind === 'master';
function legacyIsCollection(file, key) {
    const obj = S.P.files[file]; const arr = obj[key];
    if (!Array.isArray(arr)) return false;
    if (arr.length) return arr.every((o) => o && typeof o === 'object' && 'slug' in o);
    return Object.keys(obj).length === 1;
}
function collections() {
    if (isMaster()) {
        return (S.P.config.collections || []).map((c) => {
            const file = c.file || c.name + '.json', key = c.key || 'items';
            const obj = S.P.files[file] || (S.P.files[file] = { [key]: [] });
            if (!Array.isArray(obj[key])) obj[key] = [];
            return { name: c.name, label: c.label || c.name, file, key, items: obj[key], cfg: c };
        });
    }
    const out = [];
    for (const [file, obj] of Object.entries(S.P.files)) for (const key of Object.keys(obj)) if (legacyIsCollection(file, key)) out.push({ name: key, label: key, file, key, items: obj[key], cfg: null });
    return out;
}
function settingsFiles() {
    const used = new Set(collections().map((c) => c.file));
    return Object.keys(S.P.files).filter((f) => !used.has(f));
}
const titleOf = (it) => it.title || it.name || it.slug || '(untitled)';
const cur = () => S.tabs[S.active] || null;
const tabDirty = (t) => !!t.dirty || ((t.kind === 'item' || t.kind === 'settings') && S.dirtyFiles.has(t.file)) || !!t.mdDirty || (t.bufs && Object.values(t.bufs).some((b) => b.dirty));
const anyDirty = () => S.dirtyFiles.size > 0 || S.tabs.some(tabDirty) || (window.MarkdownEditor && MarkdownEditor.isDirty()) || (window.ConfigView && ConfigView.isDirty());
function itemUrl(c, it) {
    if (!c.cfg || !c.cfg.template) return '';
    return String(c.cfg.url || '{slug}.html').replace(/\{(\w+)\}/g, (m, k) => (k === 'collection' ? c.name : it[k] != null ? it[k] : ''));
}
function slugsForPages() {
    const s = [];
    for (const c of collections()) if (!c.cfg || c.cfg.template) for (const it of c.items) s.push(it.slug);
    for (const f of S.P.sources) if (f.rel.startsWith('src/pages/')) s.push(f.rel.slice(10).replace(/\.html$/, ''));
    return [...new Set(s)];
}
async function guard(fn) { try { return await fn(); } catch (e) { toast(e.message, 4000); console.error(e); } }
async function refreshScan() {
    if (!S.P) return;
    Object.assign(S.P, await api.scan());
    renderExplorer();
    if (S.view === 'dashboard') renderDashboard();
}

/* ---------- project lifecycle ---------- */
// With no project open the app shows the Overview start page (new / open / recent) inside the normal window.
async function showWelcome() {
    if (S.terminalSession) api.terminalStop(S.terminalSession).catch(() => {});
    S.terminalSession = null; S.terminalOpen = false;
    applyLayout();
    $('#terminal-output').replaceChildren(); $('#terminal-cwd').textContent = '';
    S.P = null; S.tabs = []; S.active = -1; S.dirtyFiles.clear(); S.recentProjects = [];
    if (window.MarkdownEditor) MarkdownEditor.reset();
    $('#app').hidden = false;
    $('#app').classList.add('no-project');
    $('#proj-name').textContent = 'Coral Studio';
    document.title = 'Coral Studio';
    $('#explorer').innerHTML = '';
    $('#build-btn').disabled = true;
    setView('dashboard');
    S.recentProjects = await api.recent().catch(() => []);
    if (!S.P && S.view === 'dashboard') renderDashboard();
}
async function enter(project) {
    if (!project) return;
    if (S.terminalSession) api.terminalStop(S.terminalSession).catch(() => {});
    S.terminalSession = null; S.terminalOpen = false; S.terminalHistory = []; S.terminalHistoryIndex = -1;
    $('#terminal-output').replaceChildren(); $('#terminal-cwd').textContent = '';
    if (window.MarkdownEditor) MarkdownEditor.reset();
    S.P = project; S.tabs = []; S.active = -1; S.dirtyFiles.clear(); S.build = { state: 'idle', ms: 0, code: 0 }; S.filter = '';
    $('#ex-filter').value = '';
    $('#app').hidden = false; $('#app').classList.remove('no-project');
    $('#build-btn').disabled = false;
    $('#proj-name').textContent = 'Coral Studio';
    document.title = 'Coral Studio';
    if (window.innerWidth <= 820) S.L.expOpen = true;
    applyLayout();
    setView('dashboard');
    renderAll();
}
async function openProjectFlow(dir) {
    try { await enter(await api.openProject(dir)); } catch (e) { const w = !S.P && $('#w-error'); if (w) w.textContent = e.message; else toast(e.message, 4000); }
}
async function newProjectFlow() {
    const v = await ask({
        title: 'New project', text: 'Pick a name and a language, then choose the folder that will contain the project.',
        fields: [
            { name: 'name', label: 'Site name', placeholder: 'My Studio' },
            { name: 'lang', label: 'Site language', type: 'select', value: 'en', options: [['en', 'English (left to right)'], ['ar', 'العربية (right to left)'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch']] },
            { name: 'includeMarkdown', label: 'Include Markdown content file (index.md)', type: 'checkbox', value: false },
        ],
        ok: 'Choose folder', validate: (v) => (v.name ? null : 'Please enter a name.'),
    });
    if (!v) return;
    try { await enter(await api.newProject(v.name, { lang: v.lang, dir: v.lang === 'ar' ? 'rtl' : 'ltr', includeMarkdown: v.includeMarkdown })); } catch (e) { toast(e.message, 4000); }
}

/* ---------- views ---------- */
const VIEWS = [['dashboard', 'Dashboard'], ['editor', 'Code'], ['markdown', 'Markdown'], ['config', 'JSON'], ['structure', 'Structure'], ['media', 'Media'], ['preview', 'Preview']];
function setView(v) {
    if (!S.P && v !== 'dashboard' && v !== 'app-settings') { toast('Open or create a project first.'); return; }
    S.view = v;
    $$('.view').forEach((el) => el.classList.toggle('on', el.id === 'v-' + v));
    renderToolbar();
    renderActivity();
    if (v === 'dashboard') renderDashboard();
    if (v === 'editor') renderEditor();
    if (v === 'markdown') MarkdownEditor.render();
    if (v === 'structure') StructView.render();
    if (v === 'config') ConfigView.render();
    if (v === 'media') renderMedia();
    if (v === 'preview') renderPreview();
    if (v === 'settings') SiteSettingsView.render($('#v-settings'));
    if (v === 'app-settings') renderAppSettings();
    renderStatus();
}
function terminalAppend(text, kind = 'stdout') {
    const output = $('#terminal-output'); if (!output || !text) return;
    const span = document.createElement('span'); span.className = `terminal-line${kind === 'stderr' ? ' terminal-stderr' : kind === 'command' ? ' terminal-command' : kind === 'info' ? ' terminal-info' : kind === 'success' ? ' terminal-success' : ''}`;
    span.textContent = String(text);
    output.appendChild(span);
    while (output.childNodes.length > 3000) output.removeChild(output.firstChild);
    output.scrollTop = output.scrollHeight;
}
async function startTerminalSession() {
    if (!S.P || S.terminalSession) return;
    if (S.terminalStartPromise) return S.terminalStartPromise;
    const profile = $('#terminal-profile')?.value || 'powershell';
    terminalAppend(`Starting ${profile === 'pwsh' ? 'PowerShell 7' : 'Windows PowerShell'} in ${S.P.dir}\n`, 'info');
    const startPromise = (async () => {
    try {
        const session = await api.terminalStart(profile);
        if (!S.terminalOpen || !S.P) { await api.terminalStop(session.sessionId); return; }
        S.terminalSession = session.sessionId;
        $('.terminal-indicator')?.classList.remove('off');
        $('#terminal-cwd').textContent = session.cwd;
        $('#terminal-cwd').title = session.cwd;
        $('#terminal-input')?.focus();
    } catch (err) { $('.terminal-indicator')?.classList.add('off'); terminalAppend(`${err.message}\n`, 'stderr'); }
    })();
    S.terminalStartPromise = startPromise;
    try { await startPromise; } finally { if (S.terminalStartPromise === startPromise) S.terminalStartPromise = null; }
}
function toggleTerminal(force) {
    if (!S.P) return toast('Open a project to use PowerShell.');
    S.terminalOpen = force === undefined ? !S.terminalOpen : !!force;
    applyLayout(); renderToolbar();
    if (S.terminalOpen) startTerminalSession();
}
function stopTerminalSession() {
    const session = S.terminalSession; S.terminalSession = null;
    $('.terminal-indicator')?.classList.add('off');
    if (session) api.terminalStop(session).catch((err) => terminalAppend(`${err.message}\n`, 'stderr'));
}
async function restartTerminalSession() {
    if (S.terminalStartPromise) await S.terminalStartPromise;
    stopTerminalSession();
    if (S.terminalOpen) await startTerminalSession();
}
async function submitTerminalCommand() {
    const input = $('#terminal-input'), command = input?.value || '';
    if (!input || !command.trim()) return;
    if (!S.terminalSession) await startTerminalSession();
    if (!S.terminalSession) return;
    terminalAppend(`PS> ${command}\n`, 'command');
    S.terminalHistory.push(command); S.terminalHistoryIndex = S.terminalHistory.length;
    input.value = ''; input.style.height = 'auto';
    try { await api.terminalWrite(S.terminalSession, command + '\n'); }
    catch (err) { terminalAppend(`${err.message}\n`, 'stderr'); }
}
function renderToolbar() {
    const el = $('#toolbar');
    if (!el) return;
    const tool = (act, label, glyph, active = false) => `<button data-act="${act}" class="${active ? 'on' : ''}" aria-pressed="${!!active}" title="${label}" aria-label="${label}">${icon(glyph)}</button>`;
    const group = (title, buttons, cols = 3) => `<section class="toolbar-group"><div class="toolbar-group-title">${title}</div><div class="toolbar-matrix" style="--tool-cols:${cols}">${buttons}</div></section>`;
    const workspace = () => group('Workspace',
        tool('toggle-sidebar', 'Toggle sidebar (Ctrl B)', 'sidebar', S.L.expOpen)
        + tool('terminal', 'PowerShell terminal (Ctrl J)', 'terminal', S.terminalOpen)
        + tool('devtools', 'Developer tools (F12)', 'devtools')
        + tool('folder', 'Show project folder', 'folder')
        + tool('app-settings', 'Application settings', 'appSettings'), 3);
    if (!S.P) { el.innerHTML = ''; return; }
    const workspaceTools = workspace();
    const file = S.view === 'markdown' ? MarkdownEditor.fileToolbar() : S.view === 'config' ? '' : group('File',
        tool('new-file', 'New file', 'add')
        + `<button data-act="save-current" ${hasTab() ? '' : 'disabled'} title="Save" aria-label="Save">${icon('save')}</button>`
        + `<button data-act="save-all" ${hasTab() ? '' : 'disabled'} title="Save all" aria-label="Save all">${icon('saveAll')}</button>`, 2);
    const contextual = {
        dashboard: '',
        editor: '',
        markdown: MarkdownEditor.toolbar(),
        config: ConfigView.toolbar(),
        structure: group('Structure', '<button data-struct-refresh title="Refresh site structure" aria-label="Refresh site structure">' + icon('refresh') + '</button>', 1),
        media: group('Media', tool('import', 'Import media', 'import'), 1),
        preview: group('Preview', tool('pv-reload', 'Reload preview', 'refresh') + tool('pv-ext', 'Open in browser', 'external') + tool('build', 'Build site', 'build'), 2),
        settings: group('Settings', tool('save-site-settings', 'Save settings', 'save'), 1),
        'app-settings': group('Application', tool('app-save-settings', 'Save application settings', 'save') + tool('app-reset-layout', 'Reset panel layout', 'refresh'), 2),
    }[S.view] || '';
    el.innerHTML = `<div class="toolbar-groups">${workspaceTools}${file}${contextual}</div>`;
}
function openAppSettingsFlow() { setView('app-settings'); }
async function renderAppSettings() {
    const view = $('#v-app-settings');
    S.zoom = await api.zoom();
    if (S.view !== 'app-settings') return;
    const options = Array.from({ length: 15 }, (_, i) => { const n = (i + 6) * 10; return [String(n / 100), `${n}%`]; });
    const p = S.appPrefs;
    const tabs = ['General', 'Editor', 'Files', 'Workspace'];
    let content = '';
    if (S.appSettingsTab === 'General') content = `<div class="app-setting-row"><div><b>Theme</b><small>Application color scheme</small></div><select id="app-theme"><option value="dark"${p.theme === 'dark' ? ' selected' : ''}>Dark</option><option value="light"${p.theme === 'light' ? ' selected' : ''}>Light</option></select></div>
        <div class="app-setting-row"><div><b>Accent color</b><small>Highlight color for controls</small></div><select id="app-accent">${[['#9b8cff','Violet'],['#46d6b8','Mint'],['#62a8ff','Blue'],['#f08caa','Rose'],['#e8b65a','Amber']].map(([v,l]) => `<option value="${v}"${p.accent === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="app-setting-row"><div><b>Interface zoom</b><small>Scale menus and panels</small></div><select id="app-zoom">${options.map(([v, label]) => `<option value="${v}"${Number(v) === S.zoom ? ' selected' : ''}>${label}</option>`).join('')}</select></div>`;
    if (S.appSettingsTab === 'Editor') content = `<div class="app-setting-row"><div><b>Code font size</b><small>Current size: <span id="app-font-value">${S.L.edSize}px</span></small></div><input id="app-font-size" type="range" min="10" max="24" step="1" value="${S.L.edSize}"></div>
        <label class="app-setting-row app-setting-check"><span><b>Wrap long lines</b><small>Wrap code at the editor edge</small></span><input id="app-wrap" type="checkbox" ${p.wrap ? 'checked' : ''}></label>`;
    if (S.appSettingsTab === 'Files') content = `<label class="app-setting-row app-setting-check"><span><b>Auto-save source files</b><small>Save after typing pauses</small></span><input id="app-auto-save" type="checkbox" ${p.autoSave ? 'checked' : ''}></label>
        <div class="app-setting-row"><div><b>Auto-save delay</b><small>Time to wait before saving</small></div><select id="app-save-delay" ${p.autoSave ? '' : 'disabled'}>${[[500,'0.5 seconds'],[1000,'1 second'],[2000,'2 seconds'],[5000,'5 seconds']].map(([v,l]) => `<option value="${v}"${Number(p.autoSaveDelay) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;
    if (S.appSettingsTab === 'Workspace') content = `<div class="app-setting-row"><div><b>Sidebar width</b><small>Current: <span id="app-side-value">${S.L.expW}px</span></small></div><input id="app-side-width" type="range" min="200" max="480" step="10" value="${S.L.expW}"></div>
        <div class="app-setting-row"><div><b>Terminal panel height</b><small>Current: <span id="app-terminal-value">${S.L.terminalH}px</span></small></div><input id="app-terminal-height" type="range" min="120" max="520" step="10" value="${S.L.terminalH}"></div>
        <div class="app-setting-row"><div><b>Panel layout</b><small>Restore default panel sizes</small></div><button data-act="app-reset-layout">Reset layout</button></div>
        <details class="app-shortcuts"><summary>Keyboard shortcuts</summary><div><span>Save</span><kbd>Ctrl S</kbd><span>Command palette</span><kbd>Ctrl K</kbd><span>Build site</span><kbd>Ctrl Shift B</kbd><span>Toggle sidebar</span><kbd>Ctrl B</kbd><span>Terminal</span><kbd>Ctrl J</kbd><span>Developer tools</span><kbd>F12</kbd></div></details>`;
    view.innerHTML = `<div class="app-settings-page"><header><div><span class="app-settings-kicker">APPLICATION SETTINGS</span><h1>Preferences</h1></div></header>
        <nav class="app-settings-tabs" aria-label="Settings categories">${tabs.map((tab) => `<button data-app-tab="${tab}" class="${S.appSettingsTab === tab ? 'on' : ''}">${tab}</button>`).join('')}</nav>
        <section class="app-settings-content" aria-label="${S.appSettingsTab} settings">${content}</section>
        <footer class="app-settings-footer"><span>Changes are saved automatically.</span><button data-act="app-save-settings">Save now</button></footer></div>`;
}
async function saveAppSettings(quiet = false) {
    const value = (id, fallback) => { const el = $('#' + id); return el ? el.value : fallback; };
    const checked = (id, fallback) => { const el = $('#' + id); return el ? el.checked : fallback; };
    S.appPrefs = { ...S.appPrefs,
        theme: value('app-theme', S.appPrefs.theme), accent: value('app-accent', S.appPrefs.accent),
        wrap: checked('app-wrap', S.appPrefs.wrap), autoSave: checked('app-auto-save', S.appPrefs.autoSave),
        autoSaveDelay: Number(value('app-save-delay', S.appPrefs.autoSaveDelay)),
    };
    delete S.appPrefs.formatJson;
    store.set('app-preferences', S.appPrefs);
    const layoutPatch = {};
    if ($('#app-font-size')) layoutPatch.edSize = Number($('#app-font-size').value);
    if ($('#app-side-width')) layoutPatch.expW = Number($('#app-side-width').value);
    if ($('#app-terminal-height')) layoutPatch.terminalH = Number($('#app-terminal-height').value);
    if (Object.keys(layoutPatch).length) setLayout(layoutPatch);
    applyAppPreferences();
    if ($('#app-zoom')) S.zoom = await api.zoom(Number($('#app-zoom').value));
    if (monacoCodeEditor) monacoCodeEditor.updateOptions({ wordWrap: S.appPrefs.wrap ? 'on' : 'off' });
    const side = $('#app-side-value'); if (side) side.textContent = `${S.L.expW}px`;
    const term = $('#app-terminal-value'); if (term) term.textContent = `${S.L.terminalH}px`;
    renderStatus();
    if (!quiet) toast('Application settings saved');
}
function renderActivity() {
    if (!S.P) {
        $('#activity').innerHTML = `<button data-act="new-project" title="New project" aria-label="New project">${icon('add')}</button><button data-act="open-project" title="Open project" aria-label="Open project">${icon('folder')}</button><span class="sp"></span><button data-act="app-settings" title="Application settings" aria-label="Application settings">${icon('appSettings')}</button>`;
        return;
    }
    const navViews = [...VIEWS, ['settings', 'Site settings']];
    $('#activity').innerHTML = navViews.map(([k, label]) => `<button data-view="${k}" class="${S.view === k ? 'on' : ''}" title="${label}" aria-label="${label}">${icon(k)}</button>`).join('') + `<span class="sp"></span><button data-view="app-settings" class="${S.view === 'app-settings' ? 'on' : ''}" title="Application settings" aria-label="Application settings">${icon('appSettings')}</button>`;
}
function renderAll() { renderActivity(); renderExplorer(); renderStatus(); renderToolbar(); }

/* ---------- explorer ---------- */
function srcGroup(rel) {
    if (/^(pages|layouts\/pages)\//.test(rel)) return 'pages';
    if (/^(layout\.html|layouts\/|templates\/|partials\/)/.test(rel)) return 'tpl';
    if (/^(styles|scripts)\//i.test(rel)) return 'assets';
    return 'other';
}
function renderExplorer() {
    if (!S.P) return;
    const active = cur();
    const query = S.filter.trim().toLowerCase();
    const files = [
        ...(S.P.projectFiles || S.P.sources || []),
        ...(S.P.media || []).map((f) => ({ ...f, rel: f.name })),
    ].filter((f) => !/^(?:src|dist|node_modules)(?:\/|$)/.test(f.rel) && (!query || f.rel.toLowerCase().includes(query)));
    const tree = new Map();
    for (const file of files) {
        const parts = file.rel.split('/');
        let node = tree;
        for (const part of parts) {
            if (!node.has(part)) node.set(part, { children: new Map(), file: null });
            const entry = node.get(part);
            if (part === parts[parts.length - 1]) entry.file = file;
            node = entry.children;
        }
    }
    const draw = (nodes, depth = 0, parent = '') => [...nodes.entries()].map(([name, entry]) => {
        const rel = parent ? `${parent}/${name}` : name;
        const isDir = entry.children.size > 0 || !!entry.file?.isDirectory;
        if (!isDir && !entry.file) return '';
        if (isDir) {
            const open = !!query || !S.L.collapsed['tree:' + rel];
            return `<div class="tree-folder${open ? ' open' : ''}" data-tree-toggle="${esc(rel)}" style="--tree-depth:${depth}" role="treeitem" aria-expanded="${open}"><span class="tree-chevron">${open ? '▾' : '▸'}</span><span class="tree-folder-icon">▰</span><span>${esc(name)}</span></div>${open ? `<div role="group">${draw(entry.children, depth + 1, rel)}</div>` : ''}`;
        }
        if (entry.file?.isDirectory) return `<div class="tree-folder empty-folder" style="--tree-depth:${depth}" role="treeitem" aria-expanded="false"><span class="tree-chevron"></span><span class="tree-folder-icon">▰</span><span>${esc(name)}</span></div>`;
        const relFile = entry.file.rel;
        const mediaFile = (S.P.media || []).find((m) => m.name === relFile);
        if (mediaFile) {
            return `<div class="tree-file" style="--tree-depth:${depth}" data-media-open="${esc(mediaFile.name)}" role="treeitem" title="${esc(relFile)}"><span class="tree-file-icon">${mediaFile.type === 'video' ? '▶' : '▧'}</span><span>${esc(name)}</span></div>`;
        }
        const isOn = (active && active.kind === 'text' && active.rel === relFile) || (S.view === 'markdown' && MarkdownEditor.currentRel() === relFile) || (S.view === 'config' && ConfigView.currentRel() === relFile);
            return `<div class="tree-file${isOn ? ' on' : ''}${S.tabs.some((t) => t.kind === 'text' && t.rel === relFile && tabDirty(t)) ? ' unsaved' : ''}" style="--tree-depth:${depth}" data-project-file="${esc(relFile)}" data-ctx="src:${esc(relFile)}" role="treeitem" tabindex="0" title="${esc(relFile)}"><span class="tree-file-icon">${esc(name.split('.').pop().slice(0, 1).toUpperCase())}</span><span>${esc(name)}</span></div>`;
    }).join('');
    $('#explorer').innerHTML = `<div class="project-tree" role="tree"><div class="tree-root" role="treeitem" aria-expanded="true"><span class="tree-chevron">▾</span><span class="tree-folder-icon">▰</span><b>${esc(S.P.name)}</b></div><div role="group">${draw(tree)}</div></div>`;
}

async function openProjectFile(rel) {
    if (/\.md$/i.test(rel)) return MarkdownEditor.open(rel);
    if (/\.json$/i.test(rel)) return ConfigView.open(rel);
    let i = S.tabs.findIndex((t) => t.id === 'src:' + rel);
    if (i < 0) {
        const text = await guard(() => api.readText(rel));
        if (text == null) return;
        S.tabs.push({ kind: 'text', id: 'src:' + rel, rel, text, dirty: false, pos: { l: 1, c: 1 } });
        i = S.tabs.length - 1;
    }
    showTab(i);
}

/* ---------- status bar ---------- */
function renderStatus() {
    if (!S.P) { $('#status').innerHTML = '<span>No project open</span><span class="sp"></span><span>Open a recent project or create a new one from Overview.</span>'; $('#build-btn').title = 'Build site'; $('#build-btn').setAttribute('aria-label', 'Build site'); return; }
    const b = S.build;
    const bs = b.state === 'running' ? '<span class="busy">Building…</span>' : b.state === 'ok' ? `<span class="good">Built in ${b.ms} ms</span>` : b.state === 'fail' ? '<span class="bad">Build failed</span>' : '<span>Not built yet</span>';
    const t = cur();
    const words = S.view === 'markdown' ? MarkdownEditor.wordCount() : t && typeof t.md === 'string' ? t.md.trim().split(/\s+/).filter(Boolean).length : null;
    const pos = !['markdown','config'].includes(S.view) && t && t.kind === 'text' && t.pos ? `<span>Ln ${t.pos.l}, Col ${t.pos.c}</span>` : '';
    const eng = S.P.kind === 'legacy' ? '<span title="This project has its own build.js">Custom build script</span>' : S.P.engine === 'outdated' ? '<button data-act="update-engine" title="A newer Master SSG engine is available">Engine update available</button>' : '';
    $('#status').innerHTML = `<span class="path">${esc(S.P.dir)}</span><span class="sp"></span>${eng}${pos}${words != null ? `<span>${words} words</span>` : ''}${anyDirty() ? '<span style="color:var(--accent)">Unsaved changes</span>' : '<span>All saved</span>'}${bs}<button data-act="zoom-reset" title="Interface zoom (Ctrl + / Ctrl − / Ctrl 0)">${Math.round(S.zoom * 100)}%</button>`;
    $('#build-btn').classList.toggle('running', b.state === 'running');
    $('#build-btn').title = b.state === 'running' ? 'Building…' : 'Build site';
    $('#build-btn').setAttribute('aria-label', $('#build-btn').title);
}

/* ---------- dashboard ---------- */
const dashboardGuide = `<article class="md dashboard-guide">
<h1>Coral Studio</h1>
<p><strong>A focused workspace for building, editing, and managing static websites.</strong></p>
<p>Bring your site files, content, media, build process, and local preview together in one desktop app. Use this guide to move from a fresh start or an existing project to a ready-to-publish site.</p>
<h2>Get started</h2>
<ol><li>Choose <strong>New project</strong> to create a site, or <strong>Open project</strong> to work with an existing folder.</li><li>Browse files in the Explorer. Open a file to edit it, or press <code>Ctrl K</code> to find files and actions.</li><li>Select <strong>Build site</strong>, then open <strong>Preview</strong> to review the result.</li></ol>
<h2>Your workspace</h2>
<ul><li><strong>Code:</strong> edit source files with syntax highlighting and line numbers.</li><li><strong>Markdown:</strong> edit content visually or in Markdown source mode.</li><li><strong>JSON:</strong> edit site configuration and structured data.</li><li><strong>Structure:</strong> inspect project content and data.</li><li><strong>Media:</strong> browse project images, audio, and video.</li><li><strong>Preview:</strong> view built pages locally and check common screen sizes.</li><li><strong>Terminal:</strong> run project commands in the integrated PowerShell terminal.</li></ul>
<h2>Create and build a site</h2>
<p>Start with <strong>New project</strong>, enter a name, and choose the project language and direction. If your home page is Markdown, enable the option to include <code>index.md</code>.</p>
<p>When ready, select <strong>Build site</strong> (the lightning button) or use the Build action. Coral Studio runs the project build and reports its result. Open <strong>Preview</strong> to inspect the generated pages.</p>
<h2>Work with an existing project</h2>
<p>Choose <strong>Open project</strong> and select its folder. Use the Explorer to edit files, Media to inspect assets, and Preview to review the latest build. Coral Studio keeps project-specific build scripts in place.</p>
<h2>Helpful tips</h2>
<ul><li>Press <code>Ctrl K</code> to search for a file or action.</li><li>Save edits before building so the generated site includes the latest content.</li><li>Switch between Visual editor and Markdown source to suit your writing style.</li><li>If a page looks out of date, build again and reload the preview.</li></ul>
<h2>About Coral Studio</h2>
<p>Coral Studio keeps the everyday static-site workflow in one place: edit your source, organize content and media, build, and preview. Your project remains a folder of files you can manage with your usual tools.</p>
</article>`;

function renderDashboard() {
    $('#v-dashboard').innerHTML = dashboardGuide;
}

/* ---------- media ---------- */
function renderMedia() {
    const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
    const mediaUrl = (m) => `http://127.0.0.1:${S.P.port}/__project_media__/${m.name.split('/').map(encodeURIComponent).join('/')}`;
    const active = S.mediaViewer;
    const viewer = active ? `<div class="media-viewer" role="dialog" aria-label="Media viewer"><div class="media-viewer-bar"><span title="${esc(active.name)}">${esc(active.name)}</span>${active.type === 'image' ? `<small class="media-zoom-level">${Math.round((S.mediaZoom || 1) * 100)}%</small>` : ''}<button data-act="media-close" title="Close media viewer" aria-label="Close media viewer">${icon('close')}</button></div><div class="media-viewer-stage${active.type === 'image' ? ' zoomable' : ''}" data-media-stage>${active.type === 'video' ? `<video controls autoplay src="${esc(mediaUrl(active))}"></video>` : `<img data-media-image src="${esc(mediaUrl(active))}" alt="${esc(active.name)}" style="transform:scale(${S.mediaZoom || 1})">`}</div></div>` : '';
    $('#v-media').innerHTML = `${viewer}<div class="media-head"><h2>Media library</h2><span style="color:var(--tx3)">Project images and videos · ${S.P.media.length} files</span></div>
        <div class="grid">${S.P.media.map((m) => `<button class="tile" data-media-open="${esc(m.name)}" data-ctx="media:${esc(m.name)}" title="Open ${esc(m.name)}"><div class="im">${m.type === 'video' ? `<video preload="metadata" src="${esc(mediaUrl(m))}#t=1"></video><span class="media-play">▶</span>` : `<img loading="lazy" src="${esc(mediaUrl(m))}" alt="">`}</div><div class="m"><b>${esc(m.name)}</b><small>${m.type} · ${kb(m.size)}</small></div></button>`).join('') || '<div class="blank" style="grid-column:1/-1;padding:60px"><h2>No media files</h2><div>Images and videos inside this project will appear here.</div></div>'}</div>`;
}

function setMediaZoom(value) {
    S.mediaZoom = Math.max(0.25, Math.min(8, value));
    const img = $('[data-media-image]');
    if (img) img.style.transform = `scale(${S.mediaZoom})`;
    const level = $('.media-zoom-level');
    if (level) level.textContent = `${Math.round(S.mediaZoom * 100)}%`;
}

/* ---------- preview ---------- */
let previewPath = 'index.html';
let previewWidth = 0;
function renderPreview() {
    $('#v-preview').innerHTML = `<div class="pbar"><input id="pv-path" value="${esc(previewPath)}" aria-label="Page path" spellcheck="false" list="built-pages"><datalist id="built-pages">${S.P.built.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
        <span class="seg" role="group" aria-label="Device width">${[[0, 'Fit', 'fit'], [1024, 'Tablet', 'tablet'], [390, 'Phone', 'phone']].map(([w, l, glyph]) => `<button data-pvw="${w}" class="${previewWidth === w ? 'on' : ''}" title="${l}" aria-label="${l}">${icon(glyph)}</button>`).join('')}</span></div><div class="pwrap"><iframe id="pframe" title="Site preview"></iframe></div>`;
    applyPreviewWidth(); reloadPreview();
}
function applyPreviewWidth() { const f = $('#pframe'); if (f) f.style.width = previewWidth ? previewWidth + 'px' : '100%'; }
function reloadPreview() {
    const fr = $('#pframe'); if (!fr) return;
    fr.src = `http://127.0.0.1:${S.P.port}/${encodeURI(previewPath.replace(/^\/+/, ''))}?t=${Date.now()}`;
}
function previewPage(rel) { previewPath = rel || 'index.html'; setView('preview'); }

/* ---------- creating things ---------- */
const slugValid = (s) => /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(s);
function mdPathFor(c, slug) {
    const first = c.items.find((x) => x.content);
    let dir = 'data/md';
    if (first) dir = first.content.replace(/\/[^/]*$/, '');
    else if (isMaster()) dir = 'data/md/' + c.name;
    let p = `${dir}/${slug}.md`;
    const taken = new Set(collections().flatMap((x) => x.items.map((i) => i.content)));
    for (let n = 2; taken.has(p); n++) p = `${dir}/${slug}-${n}.md`;
    return p;
}
async function addItem(c) {
    const v = await ask({
        title: `New item in ${c.label}`, text: 'A title and a slug. The slug becomes the file name of the page.', slugFrom: true,
        fields: [{ name: 'title', label: 'Title' }, { name: 'slug', label: 'Slug', hint: c.cfg && c.cfg.template ? `Page: ${itemUrl(c, { slug: '…' })}` : '' }],
        ok: 'Create',
        validate: (v) => (!v.title ? 'Please enter a title.' : !(v.slug || slugify(v.title)) ? 'Please enter a slug.' : /[\\/]/.test(v.slug) ? 'The slug cannot contain slashes.' : c.items.some((x) => x.slug === (v.slug || slugify(v.title))) ? 'That slug already exists in this collection.' : null),
    });
    if (!v) return;
    const slug = v.slug || slugify(v.title);
    const tpl = c.items[0];
    const today = new Date().toISOString().slice(0, 10);
    const content = mdPathFor(c, slug);
    let it;
    const schema = c.cfg && c.cfg.fields;
    if (tpl) {
        it = {};
        for (const [k, val] of Object.entries(tpl)) {
            if (k === 'slug') it[k] = slug;
            else if (k === 'title' || k === 'name') it[k] = v.title;
            else if (k === 'content') it[k] = content;
            else if (k === 'date' || k === 'updated') it[k] = today;
            else if (typeof val === 'boolean') it[k] = false;
            else if (typeof val === 'number') it[k] = 0;
            else if (Array.isArray(val)) it[k] = [];
            else if (val && typeof val === 'object') it[k] = {};
            else it[k] = '';
        }
        if (!('title' in it) && !('name' in it)) it.title = v.title;
    } else {
        it = { slug, title: v.title };
        for (const f of schema || []) {
            if (f.name === 'title' || f.name in it) continue;
            it[f.name] = f.type === 'bool' ? false : f.type === 'number' ? 0 : f.type === 'date' ? today : f.type === 'list' ? [] : '';
        }
        if (!schema) Object.assign(it, { subtitle: '', description: '' });
        it.content = content;
    }
    await guard(async () => {
        if (it.content) await api.writeMd(it.content, `# ${v.title}\n\n`);
        c.items.push(it);
        await api.writeJson(c.file, S.P.files[c.file]);
        renderExplorer();
        await openItem(c.file, c.key, it);
        toast('Created');
    });
}
async function duplicateItem(c, idx) {
    const src = c.items[idx];
    const slug0 = src.slug + '-copy';
    let slug = slug0; for (let n = 2; c.items.some((x) => x.slug === slug); n++) slug = `${slug0}-${n}`;
    await guard(async () => {
        const it = JSON.parse(JSON.stringify(src));
        it.slug = slug; if ('title' in it) it.title = src.title + ' (copy)'; else if ('name' in it) it.name = src.name + ' (copy)';
        if (src.content) { it.content = mdPathFor(c, slug); await api.writeMd(it.content, await api.readMd(src.content)); }
        c.items.splice(idx + 1, 0, it);
        await api.writeJson(c.file, S.P.files[c.file]);
        renderExplorer(); await openItem(c.file, c.key, it);
    });
}
async function renameItem(c, idx) {
    const it = c.items[idx];
    const v = await ask({
        title: 'Rename slug', text: 'Changes the page address. If the Markdown file is named after the slug it is renamed too.',
        fields: [{ name: 'slug', label: 'Slug', value: it.slug }], ok: 'Rename',
        validate: (v) => (!slugValid(v.slug) ? 'Use letters, numbers, dashes and underscores.' : c.items.some((x, i) => i !== idx && x.slug === v.slug) ? 'That slug already exists.' : null),
    });
    if (!v || v.slug === it.slug) return;
    await guard(async () => {
        const old = it.slug;
        if (it.content && it.content.endsWith(`/${old}.md`)) {
            const next = it.content.slice(0, -(old.length + 3)) + `${v.slug}.md`;
            const t = S.tabs.find((x) => x.item === it);
            await api.writeMd(next, t && t.mdDirty ? t.md : await api.readMd(it.content));
            await api.deleteMd(it.content);
            it.content = next;
            if (t) { t.mdDirty = false; t.md = await api.readMd(next); }
        }
        it.slug = v.slug;
        await api.writeJson(c.file, S.P.files[c.file]);
        S.dirtyFiles.delete(c.file);
        renderExplorer(); if (S.view === 'editor') renderEditor();
    });
}
async function toggleDraft(c, idx) {
    const it = c.items[idx]; it.draft = it.draft !== true;
    await guard(async () => { await api.writeJson(c.file, S.P.files[c.file]); S.dirtyFiles.delete(c.file); renderExplorer(); if (cur() && cur().item === it) renderEditor(); toast(it.draft ? 'Marked as draft' : 'Published'); });
}
async function deleteItem(c, idx) {
    const it = c.items[idx];
    if (!(await confirmBox(`Delete “${titleOf(it)}”?`, it.content ? 'The entry is removed from the data file and its Markdown file goes to the Recycle Bin.' : 'The entry is removed from the data file.', 'Delete', true))) return;
    await guard(async () => {
        const ti = S.tabs.findIndex((t) => t.item === it);
        if (ti >= 0) { S.tabs.splice(ti, 1); if (S.active >= S.tabs.length) S.active = S.tabs.length - 1; }
        c.items.splice(idx, 1);
        await api.writeJson(c.file, S.P.files[c.file]);
        S.dirtyFiles.delete(c.file);
        const shared = collections().some((x) => x.items.some((o) => o.content === it.content));
        if (it.content && !shared) await api.deleteMd(it.content);
        renderAll(); if (S.view === 'editor') renderEditor(); if (S.view === 'dashboard') renderDashboard();
    });
}

async function reloadProject() {
    const p = await api.openProject(S.P.dir);
    S.P.files = p.files; S.P.config = p.config; S.P.errors = p.errors;
    Object.assign(S.P, { sources: p.sources, regions: p.regions, includes: p.includes, media: p.media, built: p.built, engine: p.engine });
}
async function newCollectionFlow() {
    if (!isMaster()) return toast('This project has its own build script. Collections are declared in master.json projects.');
    const v = await ask({
        title: 'New collection', text: 'A group of similar items: posts, products, team members, recipes… You can name it anything.',
        fields: [
            { name: 'label', label: 'Name shown in the studio', placeholder: 'Team members' },
            { name: 'name', label: 'Name used in templates', placeholder: 'team', hint: 'Letters and digits only. In templates: {{#each team}}…{{/each}}' },
            { name: 'pages', label: 'Give every item its own page', type: 'checkbox', value: true },
            { name: 'url', label: 'Page address', placeholder: 'team/{slug}.html', hint: 'Where each item is published. Leave empty for the default.' },
        ],
        ok: 'Create',
        onInput: (form, e) => {
            if (e.target.name === 'name') form.elements.name.dataset.touched = '1';
            else if (e.target.name === 'label' && !form.elements.name.dataset.touched) form.elements.name.value = slugify(form.elements.label.value).replace(/-([a-z0-9])/g, (m, c) => c.toUpperCase()).replace(/^[^A-Za-z]+/, '');
        },
        validate: (v) => (!v.label ? 'Please enter a name.' : !/^[A-Za-z][A-Za-z0-9_]*$/.test(v.name) ? 'The template name must start with a letter and use only letters, digits and underscores.' : null),
    });
    if (!v) return;
    await guard(async () => {
        const made = await api.addCollection({ name: v.name, label: v.label, pages: v.pages, url: v.url || undefined });
        await reloadProject();
        renderAll(); if (S.view === 'dashboard') renderDashboard();
        toast(`Collection created (${made.length} files)`);
        const c = collections().find((x) => x.name === v.name);
        if (c) await addItem(c);
    });
}
async function newHtmlPageFlow() {
    const v = await ask({
        title: 'New HTML page', text: 'A hand-written page in src/pages. It can use partials, regions and any collection.', slugFrom: true,
        fields: [{ name: 'title', label: 'Title' }, { name: 'slug', label: 'File path', hint: 'e.g. services  or  docs/getting-started' }], ok: 'Create',
        validate: (v) => { const s = v.slug || slugify(v.title); return !v.title ? 'Please enter a title.' : !/^[\p{L}\p{N}_-]+(\/[\p{L}\p{N}_-]+)*$/u.test(s) ? 'Use letters, numbers, dashes and slashes for folders.' : S.P.sources.some((f) => f.rel === `src/pages/${s}.html`) ? 'That page already exists.' : null; },
    });
    if (!v) return;
    await guard(async () => {
        const rel = await api.newHtmlPage({ title: v.title, slug: v.slug || slugify(v.title) });
        await refreshScan(); await openSource(rel);
        toast('Page created. Add it to the menu in site.json (nav)', 5000);
    });
}
async function newRegionFlow() {
    const v = await ask({
        title: 'New region', text: 'A named zone of your templates whose content is Markdown. Put {{region:name}} where it should appear.',
        fields: [{ name: 'name', label: 'Region name', placeholder: 'sidebar', hint: 'Letters, digits, dashes.' }], ok: 'Create',
        validate: (v) => (!/^[A-Za-z0-9_-]+$/.test(v.name) ? 'Use letters, digits, dashes and underscores.' : null),
    });
    if (!v) return;
    await guard(async () => {
        const r = S.P.regions.find((x) => x.name === v.name);
        if (!r || !r.global) await api.writeMd(`data/regions/${v.name}.md`, '');
        await refreshScan(); await openRegion(v.name);
        toast(`Region created. Use {{region:${v.name}}} in a template to show it`, 5000);
    });
}
async function newFileFlow(initialExt = '.html', asPage = false) {
    const extensions = [['.html', 'HTML'], ['.js', 'JS'], ['.css', 'CSS'], ['.md', 'MD'], ['.json', 'JSON'], ['.xml', 'XML'], ['.txt', 'TXT']];
    const fields = [
        { name: 'name', label: 'File name', placeholder: 'new-file' },
        { name: 'ext', label: 'Extension', type: 'select', value: initialExt, options: extensions, disabled: asPage },
        { name: 'page', label: 'Page (create HTML, JSON and Markdown files)', type: 'checkbox', value: asPage },
        { name: 'dir', label: 'Subfolder path', type: 'path', value: '', placeholder: 'sections/components', action: 'select-path', buttonText: 'Select Path' },
    ];
    const roots = { '.html': 'layouts', '.js': 'scripts', '.css': 'styles', '.json': 'configs', '.md': 'data', '.xml': 'structures', '.txt': 'textes' };
    const v = await ask({
        title: 'Create new file', text: 'Enter a subfolder path using /. Leave it empty to use the default folder for the selected extension.', fields, ok: 'Create',
        onInput: (form, e) => {
            form.elements.ext.disabled = form.elements.page.checked;
        },
        onAction: async (form, action) => {
            if (action !== 'select-path') return;
            const value = form.elements.dir.value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            const valid = !value || value.split('/').every((part) => /^[\p{L}\p{N}_-]+$/u.test(part));
            if (!valid) { $('.err', form).textContent = 'Enter a valid subfolder path using /.'; return; }
            try {
                const root = form.elements.page.checked ? '' : roots[form.elements.ext.value];
                const target = [root, value].filter(Boolean).join('/');
                if (target) await api.ensurePath(target);
                form.elements.dir.value = value;
                $('.err', form).textContent = `Selected: ${target || root}/`;
            } catch (err) { $('.err', form).textContent = err.message; }
        },
        validate: (v) => {
            const pathOk = (s) => !s || !s.startsWith('/') && !s.includes('\\') && s.split('/').every((p) => /^[\p{L}\p{N}_-]+$/u.test(p));
            return !/^[\p{L}\p{N}_-]+$/u.test(v.name) ? 'Use letters, numbers, dashes and underscores in the file name.'
                : !pathOk(v.dir) ? 'Enter a valid subfolder path using /.'
                    : v.page && v.ext !== '.html' ? 'Page creates HTML, JSON and Markdown files.' : null;
        },
    });
    if (!v) return;
    const sub = v.dir;
    const rels = v.page ? null : [`${roots[v.ext]}${sub ? '/' + sub : ''}/${v.name}${v.ext}`];
    const bodyFor = (rel) => rel.endsWith('.html') ? '<!doctype html>\n<html lang="{{site.lang}}" dir="{{site.dir}}">\n<head>\n  <meta charset="utf-8">\n  <title>{{page.title}}</title>\n</head>\n<body>\n{{content}}\n</body>\n</html>\n'
        : rel.endsWith('.css') ? '/* styles */\n' : rel.endsWith('.js') ? '// scripts\n' : rel.endsWith('.json') ? '{}\n' : '';
    await guard(async () => {
        const made = v.page ? await api.createPageBundle(v.name, sub) : rels;
        if (!v.page) for (const rel of made) await api.createText(rel, bodyFor(rel));
        await refreshScan(); await openProjectFile(made[0]);
        toast(`Created ${made.length} file${made.length === 1 ? '' : 's'}`);
    });
}
function newMenuItems() {
    return [
        { label: 'HTML', run: () => newFileFlow('.html') },
        { label: 'JS', run: () => newFileFlow('.js') },
        { label: 'CSS', run: () => newFileFlow('.css') },
        { label: 'MD', run: () => newFileFlow('.md') },
        { label: 'JSON', run: () => newFileFlow('.json') },
        { label: 'XML', run: () => newFileFlow('.xml') },
        { label: 'TXT', run: () => newFileFlow('.txt') },
        { sep: true },
        { label: 'Page', run: () => newFileFlow('.html', true) },
    ];
}
async function updateEngineFlow() {
    if (!(await confirmBox('Update the engine?', 'Replaces build.js and parser.js with the versions shipped in this studio. The old files are kept as .bak. Your content and templates are not touched.', 'Update'))) return;
    await guard(async () => { await api.updateEngine(); await refreshScan(); renderStatus(); toast('Engine updated'); });
}

/* ---------- build ---------- */
async function runBuild() {
    if (S.build.state === 'running') return;
    try { await saveAll(); } catch (e) { return toast(e.message); }
    S.build = { state: 'running', ms: 0, code: 0 };
    renderStatus();
    try {
        const r = await api.build();
        S.build = { state: r.code === 0 ? 'ok' : 'fail', ms: r.ms, code: r.code };
        if (S.terminalOpen && r.output) terminalAppend(`${r.output}\n`, r.code === 0 ? 'stdout' : 'stderr');
        if (r.code === 0) toast(`Build completed in ${r.ms} ms`);
        else toast(r.message ? `Build failed: ${r.message}` : `Build failed (exit code ${r.code})`, 5000);
    } catch (e) { S.build = { state: 'fail', ms: 0, code: -1 }; toast(`Build failed: ${e.message}`, 5000); }
    renderStatus();
    await guard(() => refreshScan());
    if (S.view === 'dashboard') renderDashboard();
    if (S.view === 'preview') reloadPreview();
    if (cur() && typeof cur().md === 'string') schedulePreview(0);
}

/* ---------- zoom ---------- */
async function zoom(what) { S.zoom = await api.zoom(what); renderStatus(); }
