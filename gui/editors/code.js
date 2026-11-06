'use strict';
/* Source code editor tools: navigation, search, comments, indentation and wrapping. */
let monacoCodeEditor = null;
let monacoEditorDisposables = [];

function codeBuffer() { return $('#code'); }
function focusCodeEditor() { if (monacoCodeEditor) monacoCodeEditor.focus(); else codeBuffer()?.focus(); }
function syncCodeSelection(ta = codeBuffer(), focus = false, reveal = false) {
    if (!ta || !monacoCodeEditor) return;
    const model = monacoCodeEditor.getModel(); if (!model) return;
    const start = model.getPositionAt(ta.selectionStart), end = model.getPositionAt(ta.selectionEnd);
    monacoCodeEditor.setSelection({ startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column });
    if (reveal) monacoCodeEditor.revealRangeInCenter(monacoCodeEditor.getSelection());
    if (focus) monacoCodeEditor.focus();
}
function syncCodeEditorFromBuffer(ta = codeBuffer()) {
    if (ta && monacoCodeEditor && monacoCodeEditor.getValue() !== ta.value) {
        monacoCodeEditor.setValue(ta.value);
        syncCodeSelection(ta);
    }
}
function updateMonacoTheme() {
    const monaco = window.CoralMonaco;
    if (monaco && monacoCodeEditor) monaco.editor.setTheme(document.documentElement.dataset.appTheme === 'light' ? 'coral-light' : 'coral-dark');
}
function disposeCodeEditor() {
    monacoEditorDisposables.forEach((d) => d.dispose()); monacoEditorDisposables = [];
    if (monacoCodeEditor) { const model = monacoCodeEditor.getModel(); monacoCodeEditor.dispose(); model?.dispose(); }
    monacoCodeEditor = null;
}
function monacoLanguage(file) {
    const name = String(file || '').split('/').pop().toLowerCase();
    const ext = (name.match(/\.([^.]+)$/) || [])[1] || '';
    if (name === 'dockerfile') return 'dockerfile';
    if (name === 'makefile') return 'makefile';
    const languages = {
        js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
        ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
        json: 'json', jsonc: 'json', html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
        xml: 'xml', svg: 'xml', yml: 'yaml', yaml: 'yaml', md: 'markdown', mdx: 'markdown',
        py: 'python', pyw: 'python', sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', psm1: 'powershell',
        sql: 'sql', php: 'php', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', c: 'c', h: 'c',
        cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', cs: 'csharp', swift: 'swift', kt: 'kotlin',
        toml: 'ini', ini: 'ini', env: 'shell', bat: 'bat', cmd: 'bat', graphql: 'graphql', gql: 'graphql',
    };
    return languages[ext] || 'plaintext';
}
function mountCodeEditor(tab) {
    disposeCodeEditor();
    const host = $('#monaco-editor'), buffer = codeBuffer(), monaco = window.CoralMonaco;
    if (!host || !buffer || !monaco) return;
    const root = getComputedStyle(document.documentElement);
    const fontSize = Number(root.getPropertyValue('--ed-size').replace('px', '').trim()) || 14;
    const model = monaco.editor.createModel(tab.text, monacoLanguage(tab.rel), monaco.Uri.from({ scheme: 'inmemory', authority: 'coral', path: '/' + tab.rel }));
    monacoCodeEditor = monaco.editor.create(host, {
        model,
        theme: document.documentElement.dataset.appTheme === 'light' ? 'coral-light' : 'coral-dark',
        automaticLayout: true,
        fontFamily: root.getPropertyValue('--mono').trim(),
        fontSize,
        lineHeight: Math.round(fontSize * 1.75),
        tabSize: 2,
        insertSpaces: true,
        wordWrap: S.appPrefs.wrap ? 'on' : 'off',
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: true },
        padding: { top: 14, bottom: 14 },
    });
    const editor = monacoCodeEditor;
    monacoEditorDisposables.push(editor.onDidChangeModelContent(() => {
        if (editor !== monacoCodeEditor || !buffer.isConnected) return;
        buffer.value = editor.getValue();
        buffer.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    monacoEditorDisposables.push(editor.onDidChangeCursorSelection(() => {
        if (editor !== monacoCodeEditor || !buffer.isConnected) return;
        const selection = editor.getSelection(), model = editor.getModel();
        buffer.setSelectionRange(model.getOffsetAt({ lineNumber: selection.startLineNumber, column: selection.startColumn }), model.getOffsetAt({ lineNumber: selection.endLineNumber, column: selection.endColumn }));
        codePos(buffer); updateCodeSearchCount();
    }));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => openCodeSearch(false));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => openCodeSearch(true));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => sourceCodeAction('goto'));
    editor.focus();
}
function mountMonacoWelcome({ hostId = 'monaco-editor', language = 'javascript', sample } = {}) {
    disposeCodeEditor();
    const host = $('#' + hostId), monaco = window.CoralMonaco;
    if (!host || !monaco) return;
    const root = getComputedStyle(document.documentElement);
    const fontSize = Number(root.getPropertyValue('--ed-size').replace('px', '').trim()) || 14;
    const demo = sample || [
        '// Your next site starts with a small idea.',
        'const site = {',
        "  name: 'Coral Studio',",
        "  pages: ['home', 'work', 'contact'],",
        "  accent: '#20E3D2',",
        '};',
        '',
        'function buildSite(config) {',
        '  return config.pages.map((page) => ({',
        '    slug: page,',
        '    html: renderPage(page, config),',
        '  }));',
        '}',
        '',
        'console.log(`Ready to build ${site.pages.length} pages`);',
    ].join('\n');
    const model = monaco.editor.createModel(demo, language, monaco.Uri.from({ scheme: 'inmemory', authority: 'coral-welcome', path: '/' + hostId + '.txt' }));
    monacoCodeEditor = monaco.editor.create(host, {
        model,
        theme: document.documentElement.dataset.appTheme === 'light' ? 'coral-light' : 'coral-dark',
        readOnly: true,
        domReadOnly: true,
        automaticLayout: true,
        fontFamily: root.getPropertyValue('--mono').trim(),
        fontSize,
        lineHeight: Math.round(fontSize * 1.75),
        tabSize: 2,
        wordWrap: 'on',
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        renderLineHighlight: 'none',
        glyphMargin: false,
        folding: false,
        contextmenu: false,
        padding: { top: 22, bottom: 22 },
    });
}

function sourceEditorMarkup(t) {
    return `<div class="source-editor"><div class="source-toolbar">
        <div class="source-actions"><button data-code-action="find" title="Find (Ctrl F)">Find</button><button data-code-action="replace" title="Replace (Ctrl H)">Replace</button><button data-code-action="goto" title="Go to line (Ctrl G)">Go to line</button><button data-code-action="comment" title="Toggle line comment">Comment</button><button data-code-action="duplicate" title="Duplicate line">Duplicate</button><button data-code-action="indent" title="Indent selection">Indent</button><button data-code-action="outdent" title="Outdent selection">Outdent</button><button data-code-action="wrap" class="${S.appPrefs.wrap ? 'on' : ''}" title="Toggle line wrapping">Wrap</button><button data-code-action="copy-path" title="Copy file path">Copy path</button></div>
        <span class="source-file-meta">${esc(t.rel)} · ${t.text.split('\n').length} lines</span>
    </div><div class="code-searchbar" id="code-searchbar" hidden>
        <input id="code-find" type="search" placeholder="Find" aria-label="Find in file" autocomplete="off"><span id="code-find-count" class="code-find-count"></span>
        <input id="code-replace" type="text" placeholder="Replace" aria-label="Replace with" autocomplete="off" hidden>
        <button data-code-search="previous" title="Previous match (Shift F3)" aria-label="Previous match">↑</button><button data-code-search="next" title="Next match (F3)" aria-label="Next match">↓</button>
        <button data-code-search="replace" hidden>Replace</button><button data-code-search="replace-all" hidden>All</button><button data-code-search="close" title="Close search (Esc)" aria-label="Close search">×</button>
    </div><div class="monaco-code" id="monaco-editor" aria-label="Code editor for ${esc(t.rel)}"></div><textarea id="code" hidden tabindex="-1" aria-hidden="true" spellcheck="false">${esc(t.text)}</textarea></div>`;
}
function codeKey(e, ta) {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        const s = ta.selectionStart, ls = ta.value.lastIndexOf('\n', s - 1) + 1;
        const indent = (ta.value.slice(ls, s).match(/^[ \t]*/) || [''])[0];
        e.preventDefault(); ta.setRangeText('\n' + indent, s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); return true;
    }
    return false;
}
function codePos(ta) {
    const t = cur(); if (!t || t.kind !== 'text') return;
    const before = ta.value.slice(0, ta.selectionStart).split('\n');
    t.pos = { l: before.length, c: before[before.length - 1].length + 1 };
    renderStatus();
}
function openCodeSearch(replace = false) {
    const bar = $('#code-searchbar'), find = $('#code-find'), replacement = $('#code-replace');
    if (!bar || !find) return;
    bar.hidden = false;
    replacement.hidden = !replace;
    $$('[data-code-search="replace"], [data-code-search="replace-all"]').forEach((button) => { button.hidden = !replace; });
    find.focus(); find.select(); updateCodeSearchCount();
}
function codeMatches(query, matchCase = true) {
    const text = codeBuffer()?.value || '';
    if (!query) return [];
    const haystack = matchCase ? text : text.toLocaleLowerCase();
    const needle = matchCase ? query : query.toLocaleLowerCase();
    const matches = [];
    let at = 0;
    while ((at = haystack.indexOf(needle, at)) !== -1) { matches.push(at); at += Math.max(needle.length, 1); }
    return matches;
}
function updateCodeSearchCount() {
    const ta = codeBuffer(), query = $('#code-find')?.value || '', counter = $('#code-find-count');
    if (!ta || !counter) return;
    const matches = codeMatches(query);
    if (!matches.length) { counter.textContent = query ? 'No matches' : ''; return; }
    const current = matches.findIndex((at) => at >= ta.selectionStart && at < ta.selectionEnd);
    counter.textContent = `${current >= 0 ? current + 1 : '0'} of ${matches.length}`;
}
function sourceCodeSearch(action) {
    const ta = codeBuffer(), query = $('#code-find')?.value || '';
    if (!ta) return;
    if (action === 'close') { $('#code-searchbar').hidden = true; focusCodeEditor(); return; }
    if (action === 'replace') {
        if (query && ta.value.slice(ta.selectionStart, ta.selectionEnd) === query) {
            ta.setRangeText($('#code-replace')?.value || '', ta.selectionStart, ta.selectionEnd, 'select');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            syncCodeSelection(ta);
        }
        return sourceCodeSearch('next');
    }
    if (action === 'replace-all') {
        if (!query) return;
        const replacement = $('#code-replace')?.value || '';
        const count = ta.value.split(query).length - 1;
        if (!count) return updateCodeSearchCount();
        ta.value = ta.value.split(query).join(replacement);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        syncCodeSelection(ta);
        toast(`Replaced ${count} ${count === 1 ? 'match' : 'matches'}`);
        return updateCodeSearchCount();
    }
    const matches = codeMatches(query);
    if (!matches.length) return updateCodeSearchCount();
    const backward = action === 'previous';
    let at = backward ? -1 : matches.findIndex((index) => index >= ta.selectionEnd);
    if (backward) {
        for (let i = matches.length - 1; i >= 0; i--) if (matches[i] < ta.selectionStart) { at = i; break; }
        if (at < 0) at = matches.length - 1;
    } else if (at < 0) at = 0;
    ta.setSelectionRange(matches[at], matches[at] + query.length); syncCodeSelection(ta, true, true); updateCodeSearchCount();
}
async function sourceCodeAction(action) {
    const ta = codeBuffer(), t = cur();
    if (!ta || !t || t.kind !== 'text') return;
    if (action === 'find' || action === 'replace') return openCodeSearch(action === 'replace');
    if (action === 'goto') {
        const result = await ask({ title: 'Go to line', fields: [{ name: 'line', label: 'Line number', type: 'number', value: String(t.pos?.l || 1) }], ok: 'Go', validate: (v) => Number.isInteger(Number(v.line)) && Number(v.line) > 0 && Number(v.line) <= ta.value.split('\n').length ? null : 'Enter a line within this file.' });
        if (!result) return;
        const lines = ta.value.split('\n'), target = Number(result.line) - 1;
        const offset = lines.slice(0, target).reduce((sum, line) => sum + line.length + 1, 0);
        ta.setSelectionRange(offset, offset); syncCodeSelection(ta, true, true); codePos(ta); return;
    }
    if (action === 'wrap') {
        S.appPrefs.wrap = !S.appPrefs.wrap;
        store.set('app-preferences', S.appPrefs);
        if (monacoCodeEditor) monacoCodeEditor.updateOptions({ wordWrap: S.appPrefs.wrap ? 'on' : 'off' });
        $('[data-code-action="wrap"]')?.classList.toggle('on', S.appPrefs.wrap);
        return;
    }
    if (action === 'copy-path') return navigator.clipboard.writeText(t.rel).then(() => toast('File path copied'));
    const value = ta.value, start = ta.selectionStart, end = ta.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const rawLineEnd = value.indexOf('\n', end);
    const lineEnd = rawLineEnd < 0 ? value.length : rawLineEnd;
    const selectedLines = value.slice(lineStart, lineEnd);
    if (action === 'duplicate') {
        ta.setRangeText(`\n${selectedLines}`, lineEnd, lineEnd, 'end');
    } else if (action === 'indent' || action === 'outdent') {
        const lines = selectedLines.split('\n');
        const next = action === 'indent' ? lines.map((line) => '  ' + line).join('\n') : lines.map((line) => line.replace(/^(?: {1,2}|\t)/, '')).join('\n');
        ta.setRangeText(next, lineStart, lineEnd, 'select');
    } else if (action === 'comment') {
        const ext = (t.rel.match(/\.([^.\/]+)$/) || [, ''])[1].toLowerCase();
        const token = /^(html|htm|xml|svg)$/.test(ext) ? '<!-- ' : /^(py|sh|bash|yml|yaml|toml|rb|pl)$/.test(ext) ? '# ' : /^(js|jsx|ts|tsx|css|scss|c|cc|cpp|h|hpp|java|go|rs|php|swift|kt)$/.test(ext) ? '// ' : '';
        if (!token) return toast(`Comment syntax is unavailable for .${ext || 'file'} files.`);
        const lines = selectedLines.split('\n');
        const htmlComment = token === '<!-- ';
        const uncomment = htmlComment
            ? lines.every((line) => /^\s*<!--[\s\S]*-->\s*$/.test(line))
            : lines.every((line) => line.trimStart().startsWith(token));
        const next = lines.map((line) => {
            if (uncomment && htmlComment) { const indent = line.match(/^\s*/)[0]; return indent + line.slice(indent.length).replace(/^<!--\s?/, '').replace(/\s?-->$/, ''); }
            if (uncomment) { const indent = line.match(/^\s*/)[0]; return indent + line.slice(indent.length + token.length); }
            if (token === '<!-- ') return `${token}${line} -->`;
            const indent = line.match(/^\s*/)[0]; return indent + token + line.slice(indent.length);
        }).join('\n');
        ta.setRangeText(next, lineStart, lineEnd, 'select');
    }
    ta.dispatchEvent(new Event('input', { bubbles: true })); syncCodeSelection(ta, true); codePos(ta);
}
