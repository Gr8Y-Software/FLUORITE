'use strict';
const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
    const r = await ipcRenderer.invoke(channel, ...args);
    if (!r.ok) throw new Error(r.error);
    return r.data;
}

contextBridge.exposeInMainWorld('ssg', {
    platform: process.platform,
    recent: () => call('app:recent'),
    forgetRecent: (dir) => call('app:forgetRecent', dir),
    openProject: (dir) => call('app:open', dir),
    newProject: (name, opts) => call('app:new', name, opts),
    quit: () => call('app:quit'),
    zoom: (what) => call('app:zoom', what),
    windowAction: (what) => call('app:window', what),
    scan: () => call('project:scan'),
    structure: () => call('project:structure'),
    writeJson: (file, obj) => call('project:writeJson', file, obj),
    writeMaster: (obj) => call('project:writeMaster', obj),
    readMd: (rel) => call('project:readMd', rel),
    writeMd: (rel, text) => call('project:writeMd', rel, text),
    deleteMd: (rel) => call('project:deleteMd', rel),
    renderMd: (md) => call('project:renderMd', md),
    readText: (rel) => call('project:readText', rel),
    writeText: (rel, text) => call('project:writeText', rel, text),
    createText: (rel, text) => call('project:createText', rel, text),
    ensurePath: (rel) => call('project:ensurePath', rel),
    createPageBundle: (name, subpath) => call('project:createPageBundle', name, subpath),
    createPageFiles: (name, markdown) => call('project:createPageFiles', name, markdown),
    deleteText: (rel) => call('project:deleteText', rel),
    renameText: (from, to) => call('project:renameText', from, to),
    addCollection: (spec) => call('project:addCollection', spec),
    newHtmlPage: (spec) => call('project:newHtmlPage', spec),
    updateEngine: () => call('project:updateEngine'),
    build: () => call('project:build'),
    terminalStart: (profile) => call('terminal:start', profile),
    terminalWrite: (sessionId, text) => call('terminal:write', sessionId, text),
    terminalStop: (sessionId) => call('terminal:stop', sessionId),
    pickMediaFile: () => call('project:pickMediaFile'),
    pickMediaFolder: () => call('project:pickMediaFolder'),
    importMedia: (source, destination) => call('project:importMedia', source, destination),
    deleteMedia: (name) => call('project:deleteMedia', name),
    reveal: (rel) => call('project:reveal', rel),
    openPreview: (page) => call('project:openPreview', page),
    onCloseRequest: (cb) => ipcRenderer.on('app:close-request', () => cb()),
    onZoomKey: (cb) => ipcRenderer.on('app:zoomed', (_e, what) => cb(what)),
    onTerminalData: (cb) => ipcRenderer.on('terminal:data', (_e, data) => cb(data)),
    onTerminalError: (cb) => ipcRenderer.on('terminal:error', (_e, data) => cb(data)),
    onTerminalExit: (cb) => ipcRenderer.on('terminal:exit', (_e, data) => cb(data)),
});
