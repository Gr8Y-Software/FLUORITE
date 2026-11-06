'use strict';
/* Small UI toolkit: popup menus (menu bar + context menus), dialogs, draggable splitters, toast.
   No dependencies. Everything here is generic; app.js holds the Master SSG logic. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

function toast(msg, ms = 2400) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms);
}

/* ------------------------------------------------------------------ popup menus */
/* items: [{label, hint, run, disabled, checked, items:[...submenu], sep:true, danger}] */
const PopMenu = (() => {
    let layer = null, stack = [], onClose = null;

    function ensureLayer() {
        if (layer) return layer;
        layer = document.createElement('div');
        layer.id = 'menu-layer';
        document.body.appendChild(layer);
        layer.addEventListener('mousedown', (e) => { if (e.target === layer) close(); });
        layer.addEventListener('contextmenu', (e) => { e.preventDefault(); if (e.target === layer) close(); });
        document.addEventListener('mousedown', (e) => { if (stack.length && !e.target.closest('.pm')) close(); }, true);
        return layer;
    }
    function build(items, depth) {
        const el = document.createElement('div');
        el.className = 'pm'; el.setAttribute('role', 'menu'); el.dataset.depth = depth;
        el.innerHTML = items.map((it, i) => it.sep
            ? '<div class="pm-sep" role="separator"></div>'
            : `<div class="pm-it${it.disabled ? ' off' : ''}${it.danger ? ' danger' : ''}" role="menuitem${it.checked !== undefined ? 'checkbox' : ''}" ${it.checked !== undefined ? `aria-checked="${!!it.checked}"` : ''} tabindex="-1" data-i="${i}"><span class="pm-ck">${it.checked ? '✓' : ''}</span><span class="pm-lb">${esc(it.label)}</span>${it.items ? '<span class="pm-sub">▸</span>' : it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</div>`).join('');
        el._items = items;
        return el;
    }
    function place(el, x, y, rightOf) {
        el.style.left = '0px'; el.style.top = '0px';
        const w = el.offsetWidth, h = el.offsetHeight, W = window.innerWidth, H = window.innerHeight;
        let left = x, top = y;
        if (rightOf) { left = rightOf.right - 2; if (left + w > W - 4) left = rightOf.left - w + 2; top = y; }
        if (left + w > W - 4) left = Math.max(4, W - w - 4);
        if (top + h > H - 4) top = Math.max(4, H - h - 4);
        el.style.left = left + 'px'; el.style.top = top + 'px';
    }
    function openLevel(items, x, y, depth, rightOf) {
        while (stack.length > depth) stack.pop().remove();
        const el = build(items, depth);
        el.addEventListener('mouseover', hover);
        el.addEventListener('click', clicked);
        el.addEventListener('keydown', keys);
        ensureLayer().appendChild(el);
        place(el, x, y, rightOf);
        stack.push(el);
        return el;
    }
    function rows(el) { return $$('.pm-it:not(.off)', el); }
    function focusRow(el, row) { if (!row) return; $$('.pm-it', el).forEach((r) => r.classList.remove('on')); row.classList.add('on'); row.focus({ preventScroll: true }); }

    function activate(el, row, viaKey) {
        const it = el._items[+row.dataset.i];
        if (!it || it.disabled) return;
        if (it.items) {
            const r = row.getBoundingClientRect();
            const sub = openLevel(it.items, 0, r.top - 4, +el.dataset.depth + 1, r);
            if (viaKey) focusRow(sub, rows(sub)[0]);
            return;
        }
        const run = it.run;
        close();
        if (run) setTimeout(run, 0);
    }

    function open(items, x, y, opts = {}) {
        close();
        onClose = opts.onClose || null;
        const clean = items.filter(Boolean);
        const el = openLevel(clean, x, y, 0, null);
        layer.style.display = 'block';
        focusRow(el, rows(el)[0]);
        return el;
    }
    function hover(e) {
        const row = e.target.closest('.pm-it'); if (!row) return;
        const el = row.parentElement, depth = +el.dataset.depth;
        focusRow(el, row);
        const it = el._items[+row.dataset.i];
        while (stack.length > depth + 1) stack.pop().remove();
        if (it && it.items && !it.disabled) activate(el, row, false);
    }
    function clicked(e) {
        const row = e.target.closest('.pm-it'); if (!row) return;
        activate(row.parentElement, row, false);
    }
    function keys(e) {
        const el = e.currentTarget, list = rows(el);
        const cur = list.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { focusRow(el, list[(cur + 1) % list.length]); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { focusRow(el, list[(cur - 1 + list.length) % list.length]); e.preventDefault(); }
        else if (e.key === 'Enter' || e.key === ' ') { if (cur >= 0) activate(el, list[cur], true); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { if (cur >= 0 && el._items[+list[cur].dataset.i].items) activate(el, list[cur], true); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { if (stack.length > 1) { const sub = stack.pop(); sub.remove(); const p = stack[stack.length - 1]; focusRow(p, $('.pm-it.on', p) || rows(p)[0]); } e.preventDefault(); }
        else if (e.key === 'Escape') { close(); e.preventDefault(); e.stopPropagation(); }
        else if (e.key === 'Tab') { close(); }
    }
    function close() {
        if (!layer) return;
        stack.forEach((s) => s.remove()); stack = [];
        layer.style.display = 'none';
        const cb = onClose; onClose = null;
        if (cb) cb();
    }
    const isOpen = () => stack.length > 0;
    return { open, close, isOpen };
})();

/* ------------------------------------------------------------------ dialogs */
/* ask({title, text, fields:[{name,label,type:'text'|'select'|'checkbox'|'textarea',value,placeholder,options:[[v,label]],hint,list}],
        ok, danger, validate(values)->error|null, onInput(form)}) -> values | null */
function ask(spec) {
    const { title, text, fields = [], ok = 'OK', danger = false, validate, slugFrom = false } = spec;
    return new Promise((resolve) => {
        const ov = $('#overlay');
        const prev = document.activeElement;
        ov.hidden = false;
        const fieldHTML = (f) => {
            const id = 'm-' + f.name;
            const lab = f.label ? `<label for="${id}">${esc(f.label)}</label>` : '';
            let ctl;
            if (f.type === 'select') ctl = `<select id="${id}" name="${f.name}"${f.disabled ? ' disabled' : ''}>${(f.options || []).map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(f.value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
            else if (f.type === 'checkbox') return `<div class="f inline"><label for="${id}">${esc(f.label)}</label><span class="switch"><input type="checkbox" id="${id}" name="${f.name}"${f.value ? ' checked' : ''}><i></i></span>${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}</div>`;
            else if (f.type === 'path') ctl = `<div class="path-select-row"><input type="text" id="${id}" name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off" dir="auto"><button type="button" data-dialog-action="${esc(f.action || '')}">${esc(f.buttonText || 'Select Path')}</button></div>`;
            else if (f.type === 'button') ctl = `<button type="button" id="${id}" data-dialog-action="${esc(f.action || '')}">${esc(f.text || f.label)}</button>`;
            else if (f.type === 'textarea') ctl = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}" dir="auto">${esc(f.value || '')}</textarea>`;
            else ctl = `<input type="text" id="${id}" name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off" dir="auto"${f.list ? ` list="dl-${f.name}"` : ''}>${f.list ? `<datalist id="dl-${f.name}">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}`;
            return `<div class="f">${lab}${ctl}${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}</div>`;
        };
        ov.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${fields.map(fieldHTML).join('')}<div class="err" role="alert"></div><div class="btns"><button type="button" id="m-cancel">Cancel</button><button type="submit" class="${danger ? 'danger' : 'primary'}" id="m-ok">${esc(ok)}</button></div></form>`;
        const form = $('form', ov);
        const done = (v) => { ov.hidden = true; ov.innerHTML = ''; if (prev && prev.focus) try { prev.focus(); } catch (e) { /* gone */ } resolve(v); };
        const values = () => { const v = {}; fields.forEach((f) => { if (f.type === 'button') return; const el = form.elements[f.name]; v[f.name] = f.type === 'checkbox' ? el.checked : el.value.trim(); }); return v; };
        let slugTouched = false;
        if (slugFrom) {
            form.elements.slug.addEventListener('input', () => { slugTouched = true; });
            form.elements.title.addEventListener('input', () => { if (!slugTouched) form.elements.slug.value = slugify(form.elements.title.value); });
        }
        if (spec.onInput) form.addEventListener('input', (e) => spec.onInput(form, e));
        if (spec.onAction) form.addEventListener('click', (e) => { const b = e.target.closest('[data-dialog-action]'); if (b) Promise.resolve(spec.onAction(form, b.dataset.dialogAction)).catch((err) => { $('.err', form).textContent = err.message || String(err); }); });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            try {
                const v = values();
                const bad = validate ? validate(v) : null;
                if (bad) { $('.err', form).textContent = bad; return; }
                done(v);
            } catch (err) { $('.err', form).textContent = err.message || String(err); }
        });
        $('#m-cancel').onclick = () => done(null);
        ov.onmousedown = (e) => { if (e.target === ov) done(null); };
        form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
        const first = form.querySelector('input[type=text],textarea,select') || $('#m-ok');
        first.focus(); if (first.select && first.tagName === 'INPUT') first.select();
    });
}
const confirmBox = (title, text, ok = 'OK', danger = false) => ask({ title, text, ok, danger }).then((r) => !!r);

/* ------------------------------------------------------------------ splitters */
/* axis 'x': drag changes a width; axis 'y': a height.
   get()/set(px): current size and how to apply it; dir: +1 if dragging right/down grows the target, -1 if it shrinks it. */
function splitter(el, { axis, get, set, min = 120, max = () => 900, dir = 1, reset, onEnd }) {
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-orientation', axis === 'x' ? 'vertical' : 'horizontal');
    el.tabIndex = 0;
    const clamp = (v) => Math.round(Math.min(max(), Math.max(min, v)));
    el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const start = axis === 'x' ? e.clientX : e.clientY;
        const base = get();
        document.body.classList.add('dragging', axis === 'x' ? 'dragging-x' : 'dragging-y');
        el.classList.add('on');
        const rtl = axis === 'x' && getComputedStyle(document.documentElement).direction === 'rtl' ? -1 : 1;
        const move = (ev) => set(clamp(base + dir * rtl * ((axis === 'x' ? ev.clientX : ev.clientY) - start)));
        const up = () => {
            el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
            document.body.classList.remove('dragging', 'dragging-x', 'dragging-y'); el.classList.remove('on');
            if (onEnd) onEnd();
        };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    el.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 48 : 16;
        const k = e.key;
        const grow = axis === 'x' ? 'ArrowRight' : 'ArrowDown', shrink = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
        if (k !== grow && k !== shrink) return;
        e.preventDefault();
        set(clamp(get() + dir * (k === grow ? step : -step)));
        if (onEnd) onEnd();
    });
    if (reset) el.addEventListener('dblclick', () => { reset(); if (onEnd) onEnd(); });
}

/* ------------------------------------------------------------------ misc */
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = {
    get(k, d) { try { const v = localStorage.getItem('master-ssg:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('master-ssg:' + k, JSON.stringify(v)); } catch (e) { /* not critical */ } },
};
