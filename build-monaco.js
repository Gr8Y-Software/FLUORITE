'use strict';
const path = require('path');
const esbuild = require('esbuild');

const root = __dirname;
const outdir = path.join(root, 'gui', 'vendor', 'monaco');
const entry = (p) => path.join(root, 'node_modules', 'monaco-editor', 'esm', p);
const shared = {
    bundle: true,
    minify: true,
    platform: 'browser',
    target: ['es2022'],
    outdir,
    entryNames: '[name]',
    assetNames: 'assets/[name]-[hash]',
    loader: { '.ttf': 'file' },
    logLevel: 'info',
};

async function build() {
    await esbuild.build({
        ...shared,
        entryPoints: { monaco: path.join(root, 'gui', 'monaco-entry.js') },
        format: 'iife',
        globalName: 'CoralMonacoBundle',
        outExtension: { '.js': '.js' },
    });
    await esbuild.build({
        ...shared,
        entryPoints: {
            'editor.worker': entry('vs/editor/editor.worker.js'),
            'json.worker': entry('vs/language/json/json.worker.js'),
            'css.worker': entry('vs/language/css/css.worker.js'),
            'html.worker': entry('vs/language/html/html.worker.js'),
            'ts.worker': entry('vs/language/typescript/ts.worker.js'),
        },
        format: 'esm',
        globalName: undefined,
    });
    const fs = require('fs');
    fs.copyFileSync(path.join(root, 'node_modules', 'monaco-editor', 'LICENSE'), path.join(outdir, 'LICENSE'));
    fs.copyFileSync(path.join(root, 'node_modules', 'monaco-editor', 'ThirdPartyNotices.txt'), path.join(outdir, 'ThirdPartyNotices.txt'));
}

build().catch((error) => { console.error(error); process.exitCode = 1; });
