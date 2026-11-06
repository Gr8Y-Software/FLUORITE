'use strict';
/* Form and source modes for project JSON files. */
window.ConfigView = (() => {
    let state = { rel: '', value: null, dirty: false, errors: {}, mapMode: false, mode: 'form', rawText: '', jsonError: '', compact: false };
    const jsonText = (value, space = 2) => JSON.stringify(value, null, space);
    const displayName = (key) => String(key).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase());
    const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    const group = (title, buttons, cols = 4) => `<section class="toolbar-group"><div class="toolbar-group-title">${title}</div><div class="toolbar-matrix" style="--tool-cols:${cols}">${buttons}</div></section>`;
    const tool = (name, label, glyph) => `<button data-json-tool="${name}" ${state.rel ? '' : 'disabled'} title="${label}" aria-label="${label}">${glyph}</button>`;

    async function open(rel) {
        if (!/\.json$/i.test(rel)) return toast('Choose a JSON file.');
        if (state.dirty && state.rel !== rel && !(await confirmBox('Discard JSON changes?', `${state.rel} has unsaved edits.`, 'Discard changes', true))) return;
        state = { rel, value: null, dirty: false, errors: {}, mapMode: /\/p\.(styles|scripts)\.json$/i.test('/' + rel), mode: 'form', rawText: '', jsonError: '', compact: false };
        try {
            state.rawText = await api.readText(rel);
            try {
                state.value = JSON.parse(state.rawText);
                if (!isObject(state.value)) state.mode = 'json';
                else state.rawText = jsonText(state.value) + '\n';
            } catch (err) {
                state.mode = 'json';
                state.jsonError = err.message;
            }
        } catch (err) { state.loadError = err.message; }
        setView('config'); renderExplorer(); renderStatus(); renderToolbar();
    }
    function valueField(key, value) {
        const a = `data-config-key="${esc(key)}"`;
        if (typeof value === 'boolean') return `<label class="config-row config-boolean"><span><b>${esc(displayName(key))}</b><small>${esc(key)}</small></span><input type="checkbox" ${a} ${value ? 'checked' : ''}></label>`;
        if (typeof value === 'number') return `<label class="config-row"><span><b>${esc(displayName(key))}</b><small>${esc(key)}</small></span><input type="number" step="any" ${a} value="${esc(value)}"></label>`;
        if (value && typeof value === 'object') return `<label class="config-row config-complex"><span><b>${esc(displayName(key))}</b><small>${esc(key)} · JSON</small></span><textarea ${a} data-config-json spellcheck="false" dir="ltr">${esc(jsonText(value))}</textarea></label>`;
        return `<label class="config-row"><span><b>${esc(displayName(key))}</b><small>${esc(key)}</small></span><input type="text" ${a} value="${esc(value ?? '')}" dir="auto"></label>`;
    }
    function renderMapRows(entries) {
        return `<div class="config-map-head"><span>Project file</span><span>dist/ path</span><span></span></div>${entries.map(([source, output], index) => `<div class="config-map-row"><input type="text" data-config-map="source" data-index="${index}" aria-label="Project source path" value="${esc(source)}" placeholder="styles/site.css" dir="ltr"><input type="text" data-config-map="output" data-index="${index}" aria-label="dist output path" value="${esc(output)}" placeholder="styles/site.css" dir="ltr"><button type="button" data-config-map-remove="${index}" title="Remove mapping" aria-label="Remove mapping">×</button></div>`).join('')}<button type="button" class="config-map-add" data-config-map-add>+ Add file mapping</button>`;
    }
    function modeBar() {
        const formDisabled = !isObject(state.value) || !!state.jsonError;
        return `<div class="config-editor-bar"><div class="seg" role="group" aria-label="JSON editor mode"><button data-config-mode="form" class="${state.mode === 'form' ? 'on' : ''}" ${formDisabled ? 'disabled' : ''}>Form</button><button data-config-mode="json" class="${state.mode === 'json' ? 'on' : ''}">JSON</button></div><span class="config-editor-help">${state.mode === 'json' ? 'Edit the JSON source directly.' : 'Edit values as fields.'}</span></div>`;
    }
    function renderJsonSource() {
        const valid = !state.jsonError;
        const lines = (state.rawText.match(/\n/g) || []).length + 1;
        const summary = valid ? `${lines} lines · valid JSON` : `Invalid JSON · ${state.jsonError}`;
        return `${modeBar()}<div class="config-source-wrap"><div class="config-source-meta${valid ? '' : ' invalid'}" id="config-json-meta">${esc(summary)}</div><textarea class="config-source${valid ? '' : ' invalid'}" id="config-json-editor" spellcheck="false" dir="ltr" aria-label="JSON source">${esc(state.rawText)}</textarea></div>`;
    }
    function render() {
        const root = $('#v-config'); if (!root) return;
        disposeCodeEditor();
        if (!state.rel) {
            root.innerHTML = `<div class="config-welcome"><header class="config-welcome-head"><img src="logo.png" alt=""><div><span>STRUCTURED CONTENT</span><h1>Make data clear.</h1><p>Shape your site configuration with readable, dependable JSON.</p></div></header><section class="config-welcome-card"><div class="config-welcome-filebar"><span><i></i><b>site.json</b></span><small>READ-ONLY PREVIEW</small></div><div class="monaco-code" id="config-monaco-preview" aria-label="Read-only JSON syntax preview"></div></section><footer class="config-welcome-foot"><span>Syntax highlighting · Bracket matching · Smart editing</span><span>Choose a <code>.json</code> file in Explorer to begin</span></footer></div>`;
            mountMonacoWelcome({ hostId: 'config-monaco-preview', language: 'json', sample: '{\n  "site": {\n    "name": "Coral Studio",\n    "languages": ["en", "ar"],\n    "publish": true\n  },\n  "theme": {\n    "accent": "#20E3D2",\n    "mode": "dark"\n  },\n  "build": {\n    "output": "dist",\n    "minify": true\n  }\n}\n' });
            return;
        }
        if (state.loadError) {
            root.innerHTML = `<div class="config-page"><header><h1>${esc(state.rel.split('/').pop())}</h1></header><div class="config-error">Could not open this file: ${esc(state.loadError)}</div></div>`;
            return;
        }
        const entries = Object.entries(isObject(state.value) ? state.value : {});
        const contents = state.mode === 'json'
            ? renderJsonSource()
            : `${modeBar()}${state.mapMode ? renderMapRows(entries) : entries.length ? entries.map(([key, value]) => valueField(key, value)).join('') : '<div class="config-empty">No properties.</div>'}<div id="config-error" class="config-error" hidden></div>`;
        root.innerHTML = `<div class="config-page"><header><div><h1>${esc(state.rel.split('/').pop())}</h1><p title="${esc(state.rel)}">${esc(state.rel)}</p></div><span class="config-dirty${state.dirty ? ' on' : ''}">${state.dirty ? 'Unsaved' : 'Saved'}</span></header>
            <section class="config-card"><div class="config-card-head"><div><h2>${state.mode === 'json' ? 'JSON source' : (state.mapMode ? 'File mappings' : 'Properties')}</h2><span>${state.mode === 'json' ? `${entries.length} ${entries.length === 1 ? 'property' : 'properties'}` : `${entries.length} ${entries.length === 1 ? 'property' : 'properties'}`}</span></div></div>${contents}</section></div>`;
    }
    function updateBadge() {
        const badge = $('.config-dirty');
        if (badge) { badge.textContent = state.dirty ? 'Unsaved' : 'Saved'; badge.classList.toggle('on', state.dirty); }
    }
    function markDirty() {
        state.dirty = true;
        updateBadge(); renderToolbar(); renderStatus();
    }
    function updateValue(el) {
        if (!state.value || !el.dataset.configKey) return;
        const key = el.dataset.configKey;
        if (el.type === 'checkbox') state.value[key] = el.checked;
        else if (el.dataset.configJson !== undefined) {
            try { state.value[key] = JSON.parse(el.value); el.classList.remove('invalid'); delete state.errors[key]; }
            catch (err) { state.errors[key] = err.message; el.classList.add('invalid'); }
        } else if (el.type === 'number') {
            if (el.value === '' || !Number.isFinite(Number(el.value))) state.errors[key] = 'Enter a valid number.';
            else { state.value[key] = Number(el.value); delete state.errors[key]; }
        } else state.value[key] = el.value;
        markDirty();
        const note = $('#config-error');
        if (note) { const message = Object.entries(state.errors).map(([k, v]) => `${k}: ${v}`).join(' · '); note.textContent = message; note.hidden = !message; }
    }
    function updateJsonSource(el) {
        state.rawText = el.value;
        try {
            state.value = JSON.parse(state.rawText);
            state.jsonError = '';
            el.classList.remove('invalid');
        } catch (err) {
            state.jsonError = err.message;
            el.classList.add('invalid');
        }
        const meta = $('#config-json-meta');
        if (meta) {
            const lines = (state.rawText.match(/\n/g) || []).length + 1;
            meta.textContent = state.jsonError ? `Invalid JSON · ${state.jsonError}` : `${lines} lines · valid JSON`;
            meta.classList.toggle('invalid', !!state.jsonError);
        }
        markDirty();
    }
    function updateMap(event) {
        const add = event.target.closest('[data-config-map-add]');
        const remove = event.target.closest('[data-config-map-remove]');
        if (add) {
            let n = 1; while (Object.prototype.hasOwnProperty.call(state.value, `new-file-${n}`)) n++;
            state.value[`new-file-${n}`] = `new-file-${n}`;
            markDirty(); render(); return;
        }
        if (remove) {
            const entry = Object.entries(state.value)[Number(remove.dataset.configMapRemove)];
            if (entry) delete state.value[entry[0]];
            markDirty(); render(); return;
        }
        const input = event.target.closest('[data-config-map]');
        if (!input) return;
        const entry = Object.entries(state.value)[Number(input.dataset.index)];
        if (!entry) return;
        const [source, output] = entry;
        if (input.dataset.configMap === 'source') {
            const next = input.value.trim();
            if (next !== source && next) {
                const pairs = Object.entries(state.value); pairs[Number(input.dataset.index)] = [next, output];
                state.value = Object.fromEntries(pairs);
            }
        } else state.value[source] = input.value.trim();
        markDirty();
    }
    function switchMode(mode) {
        if (mode === state.mode) return;
        if (mode === 'json') {
            if (!state.jsonError) state.rawText = JSON.stringify(state.value, null, state.compact ? 0 : 2) + '\n';
            state.mode = 'json';
        } else {
            if (state.jsonError) return toast('Fix the JSON before switching to Form.');
            if (!isObject(state.value)) return toast('Form mode needs a JSON object.');
            state.mode = 'form';
        }
        render(); renderToolbar();
    }
    function jsonTool(action) {
        if (!state.rel) return;
        if (action === 'copy') return navigator.clipboard.writeText(state.mode === 'json' ? state.rawText : JSON.stringify(state.value, null, state.compact ? 0 : 2)).then(() => toast('JSON copied')).catch(() => toast('Clipboard is unavailable.'));
        let value;
        try { value = JSON.parse(state.mode === 'json' ? state.rawText : jsonText(state.value)); }
        catch (err) { state.jsonError = err.message; return toast(`Invalid JSON: ${err.message}`, 5000); }
        state.jsonError = '';
        if (action === 'validate') return toast('JSON is valid.');
        state.compact = action === 'minify';
        const next = JSON.stringify(value, null, state.compact ? 0 : 2) + (state.compact ? '' : '\n');
        if (state.mode === 'json') {
            state.rawText = next;
            const editor = $('#config-json-editor'); if (editor) editor.value = next;
            const meta = $('#config-json-meta'); if (meta) meta.textContent = `${(next.match(/\n/g) || []).length + 1} lines · valid JSON`;
        } else state.value = value;
        markDirty();
    }
    async function save() {
        if (!state.rel || !state.dirty) return;
        if (Object.keys(state.errors).length) return toast('Fix invalid values before saving.');
        let value = state.value;
        if (state.mode === 'json') {
            try { value = JSON.parse(state.rawText); }
            catch (err) { state.jsonError = err.message; return toast(`Fix invalid JSON before saving: ${err.message}`, 5000); }
        }
        try {
            const serialized = JSON.stringify(value, null, state.compact ? 0 : 2) + '\n';
            await api.writeText(state.rel, serialized);
            state.value = value;
            state.rawText = serialized;
            state.jsonError = ''; state.dirty = false;
            let structError = '';
            try { await api.structure(); } catch (err) { structError = err.message; }
            render(); renderToolbar(); renderExplorer(); renderStatus();
            toast(structError ? `JSON saved; structure refresh failed: ${structError}` : 'JSON saved');
        } catch (err) { toast(err.message, 4000); }
    }
    function toolbar() {
        return group('JSON', tool('format', 'Format JSON', '⟲') + tool('minify', 'Compact JSON', '≋') + tool('validate', 'Validate JSON', '✓') + tool('copy', 'Copy JSON', '⧉'), 4)
            + group('File', `<button data-config-save ${canSave() ? '' : 'disabled'} title="Save JSON" aria-label="Save JSON">${icon('save')}</button>`, 1);
    }
    function canSave() { return !!state.rel && state.dirty && !Object.keys(state.errors).length && !state.jsonError; }
    document.addEventListener('input', (e) => {
        if (e.target.id === 'config-json-editor') return updateJsonSource(e.target);
        if (e.target.closest('#v-config [data-config-key]') && e.target.type !== 'checkbox') updateValue(e.target);
    });
    document.addEventListener('change', (e) => { if (e.target.closest('#v-config [data-config-key]') && e.target.type === 'checkbox') updateValue(e.target); });
    document.addEventListener('click', (e) => {
        const mode = e.target.closest('[data-config-mode]'); if (mode) { e.preventDefault(); return switchMode(mode.dataset.configMode); }
        const action = e.target.closest('[data-json-tool]'); if (action) { e.preventDefault(); return jsonTool(action.dataset.jsonTool); }
        if (e.target.closest('[data-config-save]')) { e.preventDefault(); e.stopPropagation(); return save(); }
    });
    document.addEventListener('click', (e) => { if (state.mapMode && (e.target.closest('[data-config-map-add]') || e.target.closest('[data-config-map-remove]'))) updateMap(e); });
    document.addEventListener('change', (e) => { if (state.mapMode && e.target.closest('[data-config-map]')) updateMap(e); });
    return { open, render, toolbar, save, isDirty: () => state.dirty, canSave, currentRel: () => state.rel };
})();
