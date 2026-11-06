import * as monaco from 'monaco-editor/editor/editor.main.js';

const workerByLanguage = {
    json: 'json.worker.js',
    css: 'css.worker.js', scss: 'css.worker.js', less: 'css.worker.js',
    html: 'html.worker.js', handlebars: 'html.worker.js', razor: 'html.worker.js',
    javascript: 'ts.worker.js', typescript: 'ts.worker.js',
};

self.MonacoEnvironment = {
    getWorkerUrl(_moduleId, label) {
        return new URL(workerByLanguage[label] || 'editor.worker.js', `${location.origin}/vendor/monaco/`).href;
    },
};

monaco.editor.defineTheme('coral-dark', {
    base: 'vs-dark', inherit: true, rules: [],
    colors: {
        'editor.background': '#161922', 'editor.foreground': '#e9e6df',
        'editorLineNumber.foreground': '#70768a', 'editorLineNumber.activeForeground': '#c5c8d2',
        'editorCursor.foreground': '#46d6b8', 'editor.lineHighlightBackground': '#1d212c',
    },
});
monaco.editor.defineTheme('coral-light', {
    base: 'vs', inherit: true, rules: [],
    colors: {
        'editor.background': '#ffffff', 'editor.foreground': '#202533',
        'editorLineNumber.foreground': '#788196', 'editorLineNumber.activeForeground': '#333b4d',
        'editorCursor.foreground': '#286bff', 'editor.lineHighlightBackground': '#edf0f6',
    },
});

window.CoralMonaco = monaco;
