'use strict';
/* Standalone Markdown workspace: documents, ribbon, source mode, preview, and persistence. */
window.MarkdownEditor = (() => {
    const docs = [];
    let activePath = '', previewOpen = false, searchOpen = false, replaceOpen = false, searchQuery = '', replaceValue = '', searchIndex = -1;
    const formatToggles = { bold: false, italic: false, underline: false, strike: false, 'inline-code': false };
    const current = () => docs.find((doc) => doc.rel === activePath) || null;
    const glyphs = {
        undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 0 14h-2"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9h-9a7 7 0 0 0 0 14h2"/>',
        bold: '<path d="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a4 4 0 0 1 0 8H7z"/>', italic: '<path d="M14 4h6M4 20h6M15 4 9 20"/>', underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14"/>', strike: '<path d="M5 12h14M8 7c0-4 9-4 9 0M16 17c0 4-9 4-9 0"/>',
        code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>', clear: '<path d="m4 7 5 5-5 5M13 17h7M13 7h7"/>', paragraph: '<path d="M13 20V4h-2a5 5 0 0 0 0 10h2M17 4v16"/>', quote: '<path d="M5 11h6v8H4v-6c0-4 2-7 6-8M16 11h6v8h-7v-6c0-4 2-7 6-8"/>',
        bullets: '<path d="M10 6h11M10 12h11M10 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/>', numbers: '<path d="M10 6h11M10 12h11M10 18h11M4 5h2v3M4 12h2M4 12l2-2M4 17h2l-2 3h2"/>', task: '<rect x="3" y="4" width="5" height="5" rx="1"/><path d="m4 6 1 1 2-3M11 6h10M3 15h5v5H3zM11 17h10"/>',
        indent: '<path d="M4 6h16M4 12h9M4 18h16m-4-9 4 3-4 3"/>', outdent: '<path d="M4 6h16M11 12h9M4 18h16m4-9-4 3 4 3"/>', rule: '<path d="M4 12h16"/>', link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L12 5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/>', unlink: '<path d="m3 3 18 18M10 13a5 5 0 0 0 7.5.5l1-1M14 11a5 5 0 0 0-7.5-.5l-1 1M8 5l1-1a5 5 0 0 1 7 1M16 19l-1 1a5 5 0 0 1-7-1"/>', table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 10v10"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>', source: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>', preview: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        save: '<path d="M5 3h12l4 4v14H3V3h2zM7 3v6h10V3M7 21v-8h10v8"/>', open: '<path d="M4 20h16M5 16V5h11l3 3v8M9 11h6M9 14h6"/>', add: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
        search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>', replace: '<path d="M4 7h15l-3-3m4 3-4 3M20 17H5l3 3m-4-3 4-3"/>',
    };
    const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${glyphs[name] || ''}</svg>`;
    const button = (action, title, glyph, text = '', active = false) => `<button data-md-action="${action}" class="${active ? 'on' : ''}" ${active ? 'aria-pressed="true"' : 'aria-pressed="false"'} ${!current() ? 'disabled' : ''} title="${title}" aria-label="${title}">${glyph ? svg(glyph) : ''}${text ? `<span>${text}</span>` : ''}</button>`;
    function formatOn(command) {
        const doc = current();
        if (!doc) return false;
        const tags = { bold: ['B', 'STRONG'], italic: ['I', 'EM'], underline: ['U'], strikeThrough: ['S', 'STRIKE', 'DEL'], code: ['CODE'] }[command] || [];
        if (doc.sourceMode) {
            const ta = $('#md-source'); if (!ta) return false;
            const a = ta.selectionStart, b = ta.selectionEnd;
            const selected = ta.value.slice(a, b) || ta.value.slice(ta.value.lastIndexOf('\n', a - 1) + 1, ta.value.indexOf('\n', a) < 0 ? ta.value.length : ta.value.indexOf('\n', a));
            const patterns = { bold: /\*\*[^\n]+\*\*|__[^\n]+__/, italic: /(?:^|[^*])\*[^*\n]+\*(?!\*)|_[^_\n]+_/, underline: /<u>[\s\S]+<\/u>/i, strikeThrough: /~~[^\n]+~~/, code: /`[^`\n]+`/ };
            return !!(patterns[command] && patterns[command].test(selected));
        }
        const selection = window.getSelection();
        let node = selection?.anchorNode;
        if (node?.nodeType === 3) node = node.parentElement;
        const canvas = $('#md-canvas');
        while (node && canvas?.contains(node)) { if (tags.includes(node.tagName)) return true; node = node.parentElement; }
        try { return !!document.queryCommandState(command); } catch (_) { return false; }
    }
    const group = (title, contents, columns = 4) => `<section class="toolbar-group md-ribbon-group"><div class="toolbar-group-title">${title}</div><div class="toolbar-matrix" style="--tool-cols:${columns}">${contents}</div></section>`;
    function fileToolbar() {
        const has = !!current();
        return group('Document', `<button data-md-action="save" ${has ? '' : 'disabled'} title="Save document" aria-label="Save document">${svg('save')}</button><button data-md-action="save-all" ${docs.some((d) => d.dirty) ? '' : 'disabled'} title="Save all Markdown files" aria-label="Save all Markdown files">${svg('save')}</button>`, 2);
    }
    function toolbar() {
        const h = ['H1','H2','H3','H4','H5','H6'].map((v) => button('heading-' + v.toLowerCase(), `Heading ${v.slice(1)}`, '', v)).join('');
        return group('History', button('undo','Undo','undo') + button('redo','Redo','redo'), 2)
            + group('Inline', button('bold','Bold','bold','',formatToggles.bold) + button('italic','Italic','italic','',formatToggles.italic) + button('underline','Underline','underline','',formatToggles.underline) + button('strike','Strikethrough','strike','',formatToggles.strike) + button('inline-code','Inline code','code','',formatToggles['inline-code']) + button('clear','Clear formatting','clear'), 3)
            + group('Headings', button('paragraph','Paragraph','paragraph') + h, 4)
            + group('Lists & blocks', button('bullets','Bulleted list','bullets') + button('numbers','Numbered list','numbers') + button('task','Task list','task') + button('quote','Block quote','quote') + button('code-block','Code block','code') + button('indent','Indent','indent') + button('outdent','Outdent','outdent') + button('rule','Horizontal rule','rule'), 4)
        + group('Insert', button('link','Insert link','link') + button('unlink','Remove link','unlink') + button('table','Insert table','table') + button('image','Insert image','image') + button('toggle-source', current()?.sourceMode ? 'Visual editor' : 'Markdown source','source','',!!current()?.sourceMode) + button('preview','Toggle preview','preview','',previewOpen), 3)
            + group('Search', button('find','Find (Ctrl F)','search') + button('replace','Replace (Ctrl H)','replace'), 2);
    }
    function searchBar() {
        return `<div class="md-searchbar" id="md-searchbar" ${searchOpen ? '' : 'hidden'}><input id="md-find" type="search" placeholder="Find in document" aria-label="Find in Markdown" value="${esc(searchQuery)}" autocomplete="off"><span class="md-search-count" id="md-search-count"></span><input id="md-replace" type="text" placeholder="Replace with" aria-label="Replace text" value="${esc(replaceValue)}" ${replaceOpen ? '' : 'hidden'} autocomplete="off"><button data-md-search-action="previous" title="Previous match" aria-label="Previous match">↑</button><button data-md-search-action="next" title="Next match" aria-label="Next match">↓</button><button data-md-search-action="replace" ${replaceOpen ? '' : 'hidden'}>Replace</button><button data-md-search-action="replace-all" ${replaceOpen ? '' : 'hidden'}>All</button><button data-md-search-action="close" title="Close search" aria-label="Close search">×</button></div>`;
    }
    function render() {
        const root = $('#v-markdown'); if (!root) return;
        disposeCodeEditor();
        const doc = current();
        if (!doc) {
            root.innerHTML = `<div class="md-welcome"><header class="md-welcome-head"><img src="logo.png" alt=""><div><span>MARKDOWN STUDIO</span><h1>Shape your ideas.</h1><p>Write with Markdown, then preview clean, readable pages as you work.</p></div></header><div class="md-welcome-grid"><section class="md-welcome-paper"><div class="md-welcome-paper-label"><span>RENDERED PREVIEW</span><span>Coral Notes · 3 min read</span></div><article class="md md-welcome-copy"><h1>Build a little wonder</h1><p>Every great site begins with a clear idea. Use Markdown to give that idea <strong>shape, rhythm, and meaning</strong>.</p><h2>Keep the story clear</h2><p>Focus each page on one purpose, then guide readers with a calm visual hierarchy.</p><ul><li>Start with a helpful heading</li><li>Break up long sections</li><li>Link to the next useful step</li></ul><blockquote><p>Good content makes the next step feel natural.</p></blockquote></article></section><section class="md-welcome-source"><div class="md-welcome-source-head"><span><i></i><b>welcome.md</b></span><small>MARKDOWN SOURCE</small></div><div class="monaco-code" id="markdown-monaco-preview" aria-label="Read-only Markdown syntax preview"></div></section></div><footer class="md-welcome-foot"><span>Visual writing · Markdown source · Live preview</span><span>Open a <code>.md</code> file from Explorer to begin</span></footer></div>`;
            mountMonacoWelcome({ hostId: 'markdown-monaco-preview', language: 'markdown', sample: '# Build a little wonder\n\nEvery great site begins with a clear idea. Use Markdown to give that idea **shape, rhythm, and meaning**.\n\n## Keep the story clear\n\n- Start with a helpful heading\n- Break up long sections\n- Link to the next useful step\n\n> Good content makes the next step feel natural.' });
            return;
        }
        const tabs = docs.map((d) => `<div class="md-doc-tab${d.rel === doc.rel ? ' on' : ''}${d.dirty ? ' dirty' : ''}" data-md-tab="${esc(d.rel)}"><button class="md-doc-name" data-md-tab="${esc(d.rel)}" title="${esc(d.rel)}">${esc(d.rel.split('/').pop())}</button><button class="md-doc-close" data-md-close="${esc(d.rel)}" aria-label="Close ${esc(d.rel)}">${svg('close')}</button></div>`).join('');
        const surface = doc.sourceMode
            ? `<textarea id="md-source" class="md-source" spellcheck="false" dir="auto" aria-label="Markdown source">${esc(doc.text)}</textarea>`
            : `<article id="md-canvas" class="md-canvas" contenteditable="true" role="textbox" aria-label="Markdown document" aria-multiline="true" spellcheck="true"></article>`;
        root.innerHTML = `<div class="md-studio"><header class="md-doc-strip"><div class="md-doc-tabs">${tabs}</div><div class="md-doc-meta"><span title="${esc(doc.rel)}">${esc(doc.rel)}</span><span>${doc.dirty ? 'Unsaved' : 'Saved'}</span><span>${wordCount(doc.text)} words</span><span>${doc.text.length} chars</span></div></header>${searchBar()}<div class="md-editor-layout${previewOpen ? ' with-preview' : ''}"><div class="md-page-scroll">${surface}</div>${previewOpen ? '<iframe id="md-preview" class="md-preview" sandbox="allow-same-origin" title="Markdown preview"></iframe>' : ''}</div></div>`;
        if (!doc.sourceMode) loadCanvas(doc);
        if (previewOpen) refreshPreview(doc);
    }
    function wordCount(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }
    async function loadCanvas(doc) {
        const canvas = $('#md-canvas'); if (!canvas) return;
        try {
            const fragment = await MarkdownText.toHtml(doc.text);
            if (current() === doc && $('#md-canvas') === canvas) { canvas.replaceChildren(fragment); if (!canvas.textContent.trim()) canvas.innerHTML = '<p><br></p>'; updateMarkdownSearchCount(); }
        } catch (e) { canvas.textContent = doc.text; }
    }
    let previewTimer = 0;
    async function refreshPreview(doc) {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(async () => {
            const frame = $('#md-preview'); if (!frame || current() !== doc) return;
            try { frame.srcdoc = previewDocument(await api.renderMd(doc.text)); } catch (e) { frame.srcdoc = `<body style="font:14px system-ui;padding:24px">${esc(e.message)}</body>`; }
        }, 160);
    }
    function previewDocument(html) {
        const base = `<base href="http://127.0.0.1:${S.P.port}/"><link rel="stylesheet" href="styles/markdown.css">`;
        const dir = (S.P.files['site.json'] || {}).dir || 'ltr';
        return `<!doctype html><meta charset="utf-8">${base}<style>body{margin:0;padding:32px 40px 80px;background:#fff;color:#20232b;font:16px/1.75 system-ui,sans-serif;max-width:900px}img{max-width:100%;height:auto}pre{overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px}</style><body dir="${esc(dir)}">${html}</body>`;
    }
    async function open(rel) {
        if (!S.P || !/\.md$/i.test(rel)) return;
        let doc = docs.find((d) => d.rel === rel);
        if (!doc) {
            const text = await guard(() => api.readText(rel)); if (text == null) return;
            doc = { rel, text, dirty: false, sourceMode: false }; docs.push(doc);
        }
        activePath = rel; searchIndex = -1; setView('markdown'); renderExplorer();
    }
    async function save(doc = current()) {
        if (!doc || !doc.dirty) return;
        if (doc.sourceMode && $('#md-source') && current() === doc) doc.text = $('#md-source').value;
        await api.writeText(doc.rel, doc.text); doc.dirty = false;
        if (current() === doc) render(); renderStatus();
    }
    async function saveAll() { for (const doc of docs) await save(doc); }
    async function close(rel) {
        const doc = docs.find((d) => d.rel === rel); if (!doc) return;
        if (doc.dirty && !(await confirmBox('Close without saving?', `${doc.rel} has unsaved changes.`, 'Close document'))) return;
        clearTimeout(doc.timer);
        const index = docs.indexOf(doc); docs.splice(index, 1);
        if (activePath === rel) activePath = docs[Math.max(0, index - 1)]?.rel || docs[0]?.rel || '';
        render(); renderToolbar(); renderStatus(); renderExplorer();
    }
    function update(text) {
        const doc = current(); if (!doc) return;
        doc.text = text; doc.dirty = true; renderStatus();
        const meta = $('.md-doc-meta'); if (meta) meta.innerHTML = `<span title="${esc(doc.rel)}">${esc(doc.rel)}</span><span>Unsaved</span><span>${wordCount(text)} words</span>`;
        renderTabsIfNeeded();
        if (S.appPrefs.autoSave) { clearTimeout(doc.timer); doc.timer = setTimeout(() => guard(() => save(doc)), Number(S.appPrefs.autoSaveDelay) || 1000); }
        if (previewOpen) refreshPreview(doc);
    }
    function renderTabsIfNeeded() {
        const tab = $(`.md-doc-tab[data-md-tab="${CSS.escape(activePath)}"]`);
        if (tab) tab.classList.add('dirty');
    }
    function sourceWrap(prefix, suffix = prefix) {
        const ta = $('#md-source'); if (!ta) return false;
        const a = ta.selectionStart, b = ta.selectionEnd, selected = ta.value.slice(a, b);
        if (selected && ta.value.slice(a - prefix.length, a) === prefix && ta.value.slice(b, b + suffix.length) === suffix) {
            ta.setRangeText(selected, a - prefix.length, b + suffix.length, 'select');
        } else if (selected) ta.setRangeText(prefix + selected + suffix, a, b, 'select');
        else { ta.setRangeText(prefix + suffix, a, b, 'end'); ta.setSelectionRange(a + prefix.length, a + prefix.length); }
        ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); return true;
    }
    function sourceLine(prefix) {
        const ta = $('#md-source'); if (!ta) return false;
        const a = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1, b0 = ta.value.indexOf('\n', ta.selectionEnd), b = b0 < 0 ? ta.value.length : b0;
        let line = ta.value.slice(a, b);
        if (prefix === '') line = line.replace(/^ {1,2}/, '').replace(/^#{1,6}\s+|^[-*+]\s+|^\d+\.\s+|^>\s?/, '');
        else line = line.replace(/^#{1,6}\s+|^[-*+]\s+|^\d+\.\s+|^>\s?/, '');
        ta.setRangeText(prefix + line, a, b, 'select'); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); return true;
    }
    function insertSource(markdown) {
        const ta = $('#md-source'); if (!ta) return false;
        ta.setRangeText(markdown, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); return true;
    }
    async function action(name) {
        const doc = current(); if (!doc) return;
        const toggleCommands = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', 'inline-code': 'inline-code' };
        if (Object.prototype.hasOwnProperty.call(formatToggles, name)) {
            formatToggles[name] = !formatToggles[name];
            if (doc.sourceMode) {
                const wrappers = { bold: ['**','**'], italic: ['*','*'], underline: ['<u>','</u>'], strike: ['~~','~~'], 'inline-code': ['`','`'] };
                sourceWrap(...wrappers[name]);
            } else {
                $('#md-canvas')?.focus();
                document.execCommand(toggleCommands[name] === 'inline-code' ? 'formatBlock' : toggleCommands[name], false, toggleCommands[name] === 'inline-code' ? 'pre' : undefined);
            }
            renderToolbar();
            return;
        }
        if (name === 'save') return guard(async () => { await save(); toast('Markdown saved'); });
        if (name === 'save-all') return guard(saveAll);
        if (name === 'find' || name === 'replace') {
            searchOpen = true; replaceOpen = name === 'replace'; render(); renderToolbar(); $('#md-find')?.focus(); $('#md-find')?.select(); return;
        }
        if (name === 'preview') { previewOpen = !previewOpen; render(); renderToolbar(); return; }
        if (name === 'toggle-source') {
            if (doc.sourceMode && $('#md-source')) doc.text = $('#md-source').value;
            doc.sourceMode = !doc.sourceMode; render(); renderStatus(); return;
        }
        if (name === 'undo' || name === 'redo') { document.execCommand(name); return; }
        if (name === 'link' || name === 'image') {
            const image = name === 'image';
            const selection = window.getSelection();
            const savedRange = !doc.sourceMode && selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
            const values = await ask({ title: image ? 'Insert image' : 'Insert link', text: image ? 'Use a project media path or an image URL.' : 'Add a destination for the selected text.', fields: image ? [{ name: 'alt', label: 'Alternative text', placeholder: 'Image description' }, { name: 'url', label: 'Image path or URL', placeholder: 'assets/image/photo.jpg' }] : [{ name: 'url', label: 'URL', placeholder: 'https://example.com' }], ok: 'Insert', validate: (v) => ((image ? /^(https?:\/\/|\/|\.\.?\/|assets\/)/i.test(v.url) : /^(https?:\/\/|mailto:|\/|\.\.?\/)/i.test(v.url)) ? null : 'Enter a valid URL or project path.') });
            if (!values) return;
            if (doc.sourceMode) {
                if (image) insertSource(`![${values.alt}](${values.url})`);
                else { const ta = $('#md-source'), selected = ta.value.slice(ta.selectionStart, ta.selectionEnd) || 'Link text'; insertSource(`[${selected}](${values.url})`); }
            } else {
                const canvas = $('#md-canvas'); if (!canvas) return; canvas.focus();
                if (savedRange) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); }
                if (image) { document.execCommand('insertImage', false, values.url); const inserted = canvas.querySelector('img:last-of-type'); if (inserted) inserted.alt = values.alt; }
                else document.execCommand('createLink', false, values.url);
                update(MarkdownText.toMarkdown(canvas.innerHTML));
            }
            return;
        }
        if (name === 'table') {
            const values = await ask({ title: 'Insert table', text: 'Choose the number of rows and columns.', fields: [{ name: 'rows', label: 'Rows', type: 'number', value: '3' }, { name: 'columns', label: 'Columns', type: 'number', value: '3' }], ok: 'Insert', validate: (v) => {
                const rows = Number(v.rows), columns = Number(v.columns);
                return Number.isInteger(rows) && rows > 0 && rows <= 50 && Number.isInteger(columns) && columns > 0 && columns <= 20 ? null : 'Rows must be 1–50 and columns 1–20.';
            } });
            if (!values) return;
            const rows = Number(values.rows), columns = Number(values.columns);
            if (doc.sourceMode) {
                const line = (cells) => `| ${cells.join(' | ')} |`;
                const markdown = [line(Array.from({ length: columns }, (_, i) => `Column ${i + 1}`)), line(Array.from({ length: columns }, () => '---')), ...Array.from({ length: rows }, () => line(Array.from({ length: columns }, () => ' ')))].join('\n');
                insertSource(`\n${markdown}\n`);
            } else {
                const head = `<tr>${Array.from({ length: columns }, (_, i) => `<th>Column ${i + 1}</th>`).join('')}</tr>`;
                const body = Array.from({ length: rows }, () => `<tr>${Array.from({ length: columns }, () => '<td><br></td>').join('')}</tr>`).join('');
                const table = `<table><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`;
                const canvas = $('#md-canvas'); if (!canvas) return;
                canvas.focus(); document.execCommand('insertHTML', false, table);
                update(MarkdownText.toMarkdown(canvas.innerHTML));
            }
            return;
        }
        const headings = name.match(/^heading-h([1-6])$/);
        if (headings) {
            if (doc.sourceMode) sourceLine('#'.repeat(+headings[1]) + ' ');
            else { $('#md-canvas')?.focus(); document.execCommand('formatBlock', false, `h${headings[1]}`); }
            return;
        }
        if (doc.sourceMode) {
            const wrappers = { bold: ['**','**'], italic: ['*','*'], underline: ['<u>','</u>'], strike: ['~~','~~'], 'inline-code': ['`','`'], quote: ['> ',''], 'code-block': ['\n```\n','\n```\n'] };
            if (wrappers[name]) return sourceWrap(...wrappers[name]);
            if (name === 'clear') {
                const ta = $('#md-source'); if (!ta) return;
                const start = ta.selectionStart, end = ta.selectionEnd;
                if (start !== end) {
                    const selected = ta.value.slice(start, end).replace(/^\s{0,3}#{1,6}\s+|^\s*>\s?|^\s*[-*+]\s+|^\s*\d+\.\s+|^(\*\*|__|~~|`)|(?:(\*\*|__|~~|`))$/g, '');
                    ta.setRangeText(selected, start, end, 'select'); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
                } else sourceLine('');
                return;
            }
            const lines = { paragraph: '', bullets: '- ', numbers: '1. ', task: '- [ ] ', indent: '  ', outdent: '' };
            if (name in lines) return sourceLine(lines[name]);
            const inserts = { rule: '\n---\n', table: '\n| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n' };
            if (inserts[name]) { const ta = $('#md-source'); ta.setRangeText(inserts[name], ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
            return;
        }
        const canvas = $('#md-canvas'); if (!canvas) return; canvas.focus();
        const commands = { bold: ['bold'], italic: ['italic'], underline: ['underline'], strike: ['strikeThrough'], clear: ['removeFormat'], 'inline-code': ['insertHTML','<code>text</code>'], paragraph: ['formatBlock','p'], bullets: ['insertUnorderedList'], numbers: ['insertOrderedList'], task: ['insertHTML','<ul><li>☐ Task item</li></ul>'], quote: ['formatBlock','blockquote'], 'code-block': ['formatBlock','pre'], indent: ['indent'], outdent: ['outdent'], rule: ['insertHorizontalRule'], unlink: ['unlink'] };
        if (commands[name]) document.execCommand(...commands[name]);
        update(MarkdownText.toMarkdown(canvas.innerHTML));
    }
    function markdownMatches(query) {
        const doc = current(); if (!doc || !query) return [];
        if (doc.sourceMode) {
            const haystack = doc.text.toLocaleLowerCase(), needle = query.toLocaleLowerCase(), matches = [];
            let at = 0;
            while ((at = haystack.indexOf(needle, at)) !== -1) { matches.push({ start: at, end: at + needle.length }); at += needle.length; }
            return matches;
        }
        const canvas = $('#md-canvas'); if (!canvas) return [];
        const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT), matches = [], needle = query.toLocaleLowerCase();
        while (walker.nextNode()) {
            const node = walker.currentNode, value = node.nodeValue || '', lower = value.toLocaleLowerCase();
            let at = 0;
            while ((at = lower.indexOf(needle, at)) !== -1) { matches.push({ node, start: at, end: at + needle.length }); at += needle.length; }
        }
        return matches;
    }
    function updateMarkdownSearchCount() {
        const count = $('#md-search-count'); if (!count) return;
        const matches = markdownMatches(searchQuery);
        count.textContent = matches.length ? `${searchIndex < 0 ? 0 : searchIndex + 1} of ${matches.length}` : (searchQuery ? 'No matches' : '');
    }
    function markdownSearch(actionName) {
        const doc = current(); if (!doc) return;
        if (actionName === 'close') { searchOpen = false; $('#md-searchbar').hidden = true; return; }
        const matches = markdownMatches(searchQuery);
        if (!matches.length) return updateMarkdownSearchCount();
        if (actionName === 'next' || actionName === 'previous') {
            if (actionName === 'previous') searchIndex = searchIndex <= 0 ? matches.length - 1 : searchIndex - 1;
            else searchIndex = searchIndex + 1 >= matches.length ? 0 : searchIndex + 1;
            const match = matches[searchIndex];
            if (doc.sourceMode) {
                const ta = $('#md-source'); if (ta) { ta.focus(); ta.setSelectionRange(match.start, match.end); }
            } else {
                const canvas = $('#md-canvas'); canvas?.focus();
                const range = document.createRange(); range.setStart(match.node, match.start); range.setEnd(match.node, match.end);
                const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            }
            updateMarkdownSearchCount(); return;
        }
        const replacement = replaceValue;
        if (doc.sourceMode) {
            const ta = $('#md-source'); if (!ta) return;
            if (actionName === 'replace-all') {
                let text = doc.text;
                for (const match of [...matches].reverse()) text = text.slice(0, match.start) + replacement + text.slice(match.end);
                ta.value = text; update(text); searchIndex = -1; updateMarkdownSearchCount(); toast(`Replaced ${matches.length} matches`); return;
            }
            const match = matches[Math.max(0, Math.min(searchIndex, matches.length - 1))];
            ta.setRangeText(replacement, match.start, match.end, 'select'); ta.dispatchEvent(new Event('input', { bubbles: true })); return;
        }
        const chosen = actionName === 'replace-all' ? [...matches].reverse() : [matches[Math.max(0, Math.min(searchIndex, matches.length - 1))]];
        for (const match of chosen) {
            if (!match) continue;
            const range = document.createRange(); range.setStart(match.node, match.start); range.setEnd(match.node, match.end);
            range.deleteContents(); range.insertNode(document.createTextNode(replacement));
        }
        const canvas = $('#md-canvas'); if (canvas) update(MarkdownText.toMarkdown(canvas.innerHTML));
        if (actionName === 'replace-all') toast(`Replaced ${matches.length} matches`);
        searchIndex = -1; updateMarkdownSearchCount();
    }
    function handleClick(e) {
        const searchAction = e.target.closest('[data-md-search-action]');
        if (searchAction) { e.preventDefault(); markdownSearch(searchAction.dataset.mdSearchAction); return true; }
        const actionButton = e.target.closest('[data-md-action]'); if (actionButton) { e.preventDefault(); action(actionButton.dataset.mdAction); return true; }
        const tab = e.target.closest('[data-md-tab]'); if (tab && !e.target.closest('[data-md-close]')) { activePath = tab.dataset.mdTab; searchIndex = -1; render(); renderToolbar(); return true; }
        const closeButton = e.target.closest('[data-md-close]'); if (closeButton) { close(closeButton.dataset.mdClose); return true; }
        return false;
    }
    function bind() {
        document.addEventListener('click', (e) => { if (handleClick(e)) e.stopPropagation(); });
        document.addEventListener('mousedown', (e) => { if (e.target.closest('[data-md-action], [data-md-search-action]')) e.preventDefault(); });
        document.addEventListener('input', (e) => {
            const doc = current(); if (!doc) return;
            if (e.target.id === 'md-find') { searchQuery = e.target.value; searchIndex = -1; updateMarkdownSearchCount(); }
            else if (e.target.id === 'md-replace') replaceValue = e.target.value;
            else if (e.target.id === 'md-canvas') update(MarkdownText.toMarkdown(e.target.innerHTML));
            else if (e.target.id === 'md-source') {
                const ta = e.target;
                ta.value = ta.value.replace(/(\*\*|~~|__|`|<u><\/u>)(?=\n|$)/g, '');
                update(ta.value);
            }
        });
        document.addEventListener('selectionchange', () => { if (S.view === 'markdown' && !current()?.sourceMode) renderToolbar(); });
        document.addEventListener('keyup', (e) => { if (e.target.id === 'md-canvas') renderToolbar(); });
        document.addEventListener('keydown', (e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (S.view === 'markdown' && e.target.id === 'md-find' && e.key === 'Enter') { e.preventDefault(); markdownSearch(e.shiftKey ? 'previous' : 'next'); return; }
            if (S.view === 'markdown' && e.target.id === 'md-find' && e.key === 'Escape') { e.preventDefault(); markdownSearch('close'); return; }
            if (S.view === 'markdown' && e.key === 'F3' && searchOpen) { e.preventDefault(); markdownSearch(e.shiftKey ? 'previous' : 'next'); return; }
            if (S.view === 'markdown' && e.key === 'Escape' && searchOpen) { e.preventDefault(); markdownSearch('close'); return; }
            if (S.view === 'markdown' && (e.target.id === 'md-source' || e.target.id === 'md-canvas') && mod && ['f','h'].includes(e.key.toLowerCase())) { e.preventDefault(); action(e.key.toLowerCase() === 'h' ? 'replace' : 'find'); }
        });
    }
    function isDirty() { return docs.some((doc) => doc.dirty); }
    function reset() { docs.forEach((doc) => clearTimeout(doc.timer)); docs.length = 0; activePath = ''; searchOpen = false; replaceOpen = false; searchQuery = ''; replaceValue = ''; searchIndex = -1; }
    bind();
    return { open, render, toolbar, fileToolbar, save, saveAll, isDirty, reset, currentRel: () => activePath, wordCount: () => wordCount(current()?.text || '') };
})();
