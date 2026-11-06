'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const project = require('./lib/project');
const serve = require('./lib/serve');
const serveApp = require('./lib/serve-app');

const STARTER = path.join(__dirname, 'starter');
let win = null;
let cur = null; // absolute path of the open project
let port = 0;
let appServer = null;
let forceClose = false;
let terminalProcess = null;
let terminalSession = 0;

/* ---------- small persisted preferences (window size, zoom, recent projects) ---------- */
const userFile = (n) => path.join(app.getPath('userData'), n);
function readJsonSafe(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
const readPrefs = () => readJsonSafe(userFile('prefs.json'), {});
function writePrefs(patch) { try { fs.writeFileSync(userFile('prefs.json'), JSON.stringify({ ...readPrefs(), ...patch })); } catch (e) { /* not critical */ } }
const readRecent = () => readJsonSafe(userFile('recent.json'), []).filter((r) => fs.existsSync(r.dir));
function pushRecent(dir, name) {
    const list = readRecent().filter((r) => r.dir !== dir);
    list.unshift({ dir, name, at: Date.now() });
    try { fs.writeFileSync(userFile('recent.json'), JSON.stringify(list.slice(0, 10))); } catch (e) { /* not critical */ }
}

function openDir(dir) {
    stopTerminal();
    const p = project.loadProject(dir, STARTER);
    cur = dir;
    pushRecent(dir, p.name);
    return { ...p, port };
}
const need = () => { if (!cur) throw new Error('No project is open.'); return cur; };
function stopTerminal(sessionId) {
    if (!terminalProcess || (sessionId && sessionId !== terminalSession)) return false;
    const child = terminalProcess;
    terminalProcess = null;
    try { child.kill(); } catch (e) { /* the process may already have exited */ }
    return true;
}
async function startTerminal(profile = 'powershell') {
    const cwd = need();
    stopTerminal();
    const shell = profile === 'pwsh' ? 'pwsh.exe' : 'powershell.exe';
    // Load the user's PowerShell profile so aliases, modules, and prompt customizations work.
    const args = ['-NoLogo', '-NoExit', '-File', '-'];
    const child = spawn(shell, args, { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const sessionId = ++terminalSession;
    terminalProcess = child;
    const send = (channel, payload) => { if (win && !win.isDestroyed()) win.webContents.send(channel, { sessionId, ...payload }); };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (text) => send('terminal:data', { stream: 'stdout', text }));
    child.stderr.on('data', (text) => send('terminal:data', { stream: 'stderr', text }));
    child.on('exit', (code, signal) => {
        send('terminal:exit', { code, signal });
        if (terminalProcess === child) terminalProcess = null;
    });
    await new Promise((resolve, reject) => {
        let spawned = false;
        child.once('spawn', () => {
            spawned = true;
            child.stdin.write('$OutputEncoding = New-Object System.Text.UTF8Encoding\n[Console]::OutputEncoding = $OutputEncoding\n');
            resolve();
        });
        child.on('error', (err) => {
            if (terminalProcess === child) terminalProcess = null;
            if (!spawned) reject(new Error(`${shell} could not start: ${err.message}`));
            else send('terminal:error', { message: err.message });
        });
    });
    return { sessionId, shell, cwd };
}

// Every handler returns {ok, data} or {ok:false, error}; preload turns that back into resolve/throw.
function h(channel, fn) {
    ipcMain.handle(channel, async (_e, ...args) => {
        try { return { ok: true, data: await fn(...args) }; } catch (err) { return { ok: false, error: err.message }; }
    });
}
const trash = async (abs) => { if (fs.existsSync(abs)) await shell.trashItem(abs); };

h('app:recent', () => readRecent());
h('app:forgetRecent', (dir) => {
    const list = readRecent().filter((r) => r.dir !== dir);
    try { fs.writeFileSync(userFile('recent.json'), JSON.stringify(list)); } catch (e) { /* not critical */ }
    return list;
});
h('app:open', async (dir) => {
    if (!dir) {
        const r = await dialog.showOpenDialog(win, { title: 'Open a project folder', properties: ['openDirectory'] });
        if (r.canceled || !r.filePaths[0]) return null;
        dir = r.filePaths[0];
    }
    return openDir(dir);
});
h('app:new', async (name, opts) => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose where to create the project', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return openDir(project.createProject(r.filePaths[0], name, STARTER, opts || {}));
});
h('app:quit', () => { forceClose = true; win.close(); });
h('app:zoom', (what) => {
    const wc = win.webContents;
    let f = wc.getZoomFactor();
    if (what === 'in') f += 0.1; else if (what === 'out') f -= 0.1; else if (what === 'reset') f = 1; else if (typeof what === 'number') f = what;
    f = Math.min(2, Math.max(0.6, Math.round(f * 10) / 10));
    wc.setZoomFactor(f);
    writePrefs({ zoom: f });
    return f;
});
h('app:window', (what) => {
    if (what === 'fullscreen') win.setFullScreen(!win.isFullScreen());
    else if (what === 'maximize') (win.isMaximized() ? win.unmaximize() : win.maximize());
    else if (what === 'minimize') win.minimize();
    else if (what === 'close') win.close();
    else if (what === 'reload') win.webContents.reload();
    else if (what === 'devtools') {
        if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
        else win.webContents.openDevTools({ mode: 'bottom' });
    }
});

h('project:scan', () => project.scan(need(), STARTER));
h('project:structure', () => project.readStructure(need()));
h('project:writeJson', (file, obj) => project.writeJson(need(), file, obj));
h('project:writeMaster', (obj) => project.writeMaster(need(), obj));
h('project:readMd', (rel) => project.readMd(need(), rel));
h('project:writeMd', (rel, text) => project.writeMd(need(), rel, text));
h('project:deleteMd', (rel) => trash(project.mdAbs(need(), rel)));
h('project:renderMd', (md) => project.renderMarkdown(need(), md));
h('project:readText', (rel) => project.readText(need(), rel));
h('project:writeText', (rel, text) => project.writeText(need(), rel, text));
h('project:createText', (rel, text) => project.createText(need(), rel, text));
h('project:ensurePath', (rel) => project.ensureProjectPath(need(), rel));
h('project:createPageBundle', (name, subpath) => project.createPageBundle(need(), name, subpath));
h('project:createPageFiles', (name, markdown) => project.createPageFiles(need(), name, markdown));
h('project:deleteText', (rel) => trash(project.textAbs(need(), rel)));
h('project:renameText', (from, to) => project.renameFile(need(), from, to));
h('project:addCollection', (spec) => project.addCollection(need(), spec));
h('project:newHtmlPage', (spec) => project.newHtmlPage(need(), spec));
h('project:updateEngine', () => project.updateEngine(need(), STARTER));
h('project:build', () => project.build(need()));
h('terminal:start', (profile) => startTerminal(profile));
h('terminal:write', (sessionId, text) => {
    if (!terminalProcess || sessionId !== terminalSession) throw new Error('The PowerShell session is not running.');
    const command = String(text || '');
    if (command.length > 50000) throw new Error('Command is too long.');
    terminalProcess.stdin.write(command);
    return true;
});
h('terminal:stop', (sessionId) => stopTerminal(sessionId));
h('project:pickMediaFile', async () => {
    const r = await dialog.showOpenDialog(win, {
        title: 'Choose an image or video', properties: ['openFile'],
        filters: [{ name: 'Images and videos', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'ico', 'mp4', 'm4v', 'webm', 'ogv', 'mov', 'mkv'] }],
    });
    return r.canceled ? '' : r.filePaths[0];
});
h('project:pickMediaFolder', async () => {
    const r = await dialog.showOpenDialog(win, {
        title: 'Choose destination folder inside project', defaultPath: need(), properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled) return '';
    const root = path.resolve(need()), chosen = path.resolve(r.filePaths[0]);
    if (chosen !== root && !chosen.startsWith(root + path.sep)) throw new Error('Choose a folder inside the open project.');
    return path.relative(root, chosen).split(path.sep).join('/') || '.';
});
h('project:importMedia', (source, destination) => {
    project.importMedia(need(), source, destination);
    return project.listMedia(need());
});
h('project:deleteMedia', async (name) => { await trash(project.mediaAbs(need(), name)); return project.listMedia(need()); });
h('project:reveal', (rel) => (rel ? shell.showItemInFolder(path.join(need(), rel)) : shell.openPath(need())));
h('project:openPreview', (page) => {
    need();
    const clean = String(page || 'index.html').replace(/^\/+/, '');
    return shell.openExternal(`http://127.0.0.1:${port}/${encodeURI(clean)}`);
});

async function createWindow() {
    const prefs = readPrefs();
    const b = prefs.bounds || {};
    win = new BrowserWindow({
        width: b.width || 1400, height: b.height || 900, x: b.x, y: b.y,
        minWidth: 760, minHeight: 520,
        backgroundColor: '#101218', title: 'Coral Studio', show: false,
        titleBarStyle: 'hidden',
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: true },
    });
    if (prefs.max) win.maximize();
    if (prefs.zoom) win.webContents.setZoomFactor(prefs.zoom);
    win.once('ready-to-show', () => win.show());
    const saveBounds = () => { if (!win.isMaximized() && !win.isFullScreen() && !win.isMinimized()) writePrefs({ bounds: win.getBounds(), max: false }); };
    win.on('resized', saveBounds); win.on('moved', saveBounds);
    win.on('maximize', () => writePrefs({ max: true })); win.on('unmaximize', () => writePrefs({ max: false }));
    win.on('close', (e) => {
        if (!forceClose && cur) { e.preventDefault(); win.webContents.send('app:close-request'); }
    });
    // window shortcuts that work everywhere (the app has no native menu bar)
    win.webContents.on('before-input-event', (e, i) => {
        if (i.type !== 'keyDown') return;
        const mod = i.control || i.meta;
        if (mod && (i.key === '=' || i.key === '+')) { e.preventDefault(); win.webContents.send('app:zoomed', 'in'); }
        else if (mod && i.key === '-') { e.preventDefault(); win.webContents.send('app:zoomed', 'out'); }
        else if (mod && i.key === '0') { e.preventDefault(); win.webContents.send('app:zoomed', 'reset'); }
        else if (i.key === 'F11') { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
        else if (i.key === 'F12' || (mod && i.shift && i.key.toLowerCase() === 'i')) {
            e.preventDefault();
            if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
            else win.webContents.openDevTools({ mode: 'bottom' });
        }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    await win.loadURL(`http://127.0.0.1:${appServer.port}/index.html`);
    if (prefs.zoom) win.webContents.setZoomFactor(prefs.zoom);
}

app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    appServer = await serveApp.start();
    port = (await serve.start(() => cur)).port;
    await createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { stopTerminal(); appServer?.server.close(); });
