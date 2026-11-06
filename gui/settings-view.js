'use strict';
/* Site settings: a form over the general fields of root site.json.
   Edits go straight into S.P.files['site.json'] and use the normal unsaved/save flow, so Ctrl S,
   "Save all" and the quit prompt all work. Keys the form does not show (nav, cta, footer_links,
   theme.radius, other icons ...) are never touched. */
window.SiteSettingsView = (() => {
    const FILE = 'site.json';
    const ICON_SIZE = { icon_512: '512x512', icon_192: '192x192' };
    const site = () => S.P.files[FILE] || (S.P.files[FILE] = {});
    const text = (v) => (v == null || typeof v === 'object' ? '' : String(v));
    const generatorDefaults = { manifest: ['manifest.webmanifest', true], sitemap: ['sitemap.xml', true], robots: ['robots.txt', true], aiContext: ['ai-context.txt', true] };
    const generator = (s, key) => ({ ...Object.fromEntries(['file', 'enabled'].map((part) => [part, s.generators?.[key]?.[part] ?? (part === 'file' ? generatorDefaults[key][0] : generatorDefaults[key][1])])) });
    const iconAt = (s, size) => (Array.isArray(s.icons) ? s.icons.findIndex((i) => i && i.sizes === size) : -1);

    function get(s, key) {
        if (key === 'theme_color') return text(s.theme_color ?? (s.theme && s.theme.accent));
        if (ICON_SIZE[key]) {
            if (Object.prototype.hasOwnProperty.call(s, key)) return text(s[key]);
            const i = iconAt(s, ICON_SIZE[key]); return i < 0 ? '' : text(s.icons[i].src);
        }
        return text(s[key]);
    }
    function set(s, key, value) {
        if (key === 'theme_color') {
            s.theme_color = value; return;
        }
        if (ICON_SIZE[key]) {
            s[key] = value; return;
        }
        s[key] = value;
    }

    function render(root) {
        const s = site();
        const v = (k) => esc(get(s, k));
        const sel = (k, o) => (get(s, k) === o ? ' selected' : '');
        root.innerHTML = `<div class="settings-view">
            <div class="settings-heading"><h1>Site settings</h1></div>
            <form class="settings-columns" autocomplete="off" onsubmit="return false">
                <section class="settings-card"><div class="settings-fields">
                    <label>Site URL<input data-site="url" dir="ltr" value="${v('url')}" placeholder="https://example.com"></label>
                    <label>Logo<input data-site="logo" dir="ltr" value="${v('logo')}" placeholder="logo.svg" list="media-list"></label>
                    <label>512 \u00d7 512 icon URL<input data-site="icon_512" dir="ltr" value="${v('icon_512')}" placeholder="assets/img/icon-512.png"></label>
                    <label>192 \u00d7 192 icon URL<input data-site="icon_192" dir="ltr" value="${v('icon_192')}" placeholder="assets/img/icon-192.png"></label>
                    <label>Link preview image<input data-site="og_image" dir="ltr" value="${v('og_image')}" placeholder="social-preview.jpg" list="media-list"></label>
                    <div class="settings-compact">
                        <label>Language code<input data-site="lang" dir="ltr" value="${v('lang')}" placeholder="en"></label>
                        <label>Text direction<select data-site="dir"><option value=""${sel('dir', '')}>Unspecified</option><option value="ltr"${sel('dir', 'ltr')}>Left to right</option><option value="rtl"${sel('dir', 'rtl')}>Right to left</option></select></label>
                        <label>Theme color<input data-site="theme_color" dir="ltr" value="${v('theme_color')}" placeholder="#4f46e5"></label>
                    </div>
                </div></section>
                <section class="settings-card settings-description">
                    <label>Site name<input data-site="name" value="${v('name')}"></label>
                    <label>Short name<input data-site="short_name" value="${v('short_name')}" placeholder="Used as the app name on a phone home screen"></label>
                    <label>Tagline<input data-site="tagline" value="${v('tagline')}"></label>
                    <h2>Site description</h2>
                    <label><textarea data-site="description">${v('description')}</textarea></label>
                </section>
            </form>
            <datalist id="media-list">${S.P.media.map((m) => `<option value="${esc(m.name)}">`).join('')}</datalist>
            <details class="settings-advanced"><summary>Advanced · generated files</summary><div class="settings-advanced-body">
                ${[['manifest','Web app manifest'],['sitemap','Sitemap'],['robots','Robots rules'],['aiContext','AI context']].map(([key,label]) => { const g = generator(s,key); return `<div class="generator-setting"><label class="generator-enabled"><input type="checkbox" data-generator="${key}" data-generator-part="enabled" ${g.enabled ? 'checked' : ''}><span><b>${label}</b><small>${key === 'aiContext' ? 'Plain text summary of generated pages' : `Generate ${label.toLowerCase()} during build`}</small></span></label><label class="generator-file">Output file<input type="text" dir="ltr" data-generator="${key}" data-generator-part="file" value="${esc(g.file)}"></label></div>`; }).join('')}
            </div></details>
            <div class="settings-message" role="status">${S.dirtyFiles.has(FILE) ? 'Unsaved changes.' : ''}</div></div>`;
        const onEdit = (e) => {
            const gen = e.target.closest('[data-generator]');
            if (gen) {
                s.generators ||= {};
                s.generators[gen.dataset.generator] ||= {};
                s.generators[gen.dataset.generator][gen.dataset.generatorPart] = gen.type === 'checkbox' ? gen.checked : gen.value.trim();
                markDirty(FILE);
                const m = root.querySelector('.settings-message'); if (m) m.textContent = 'Unsaved changes.';
                return;
            }
            const el = e.target.closest('[data-site]'); if (!el) return;
            set(site(), el.dataset.site, el.value.trim());
            markDirty(FILE);
            const m = root.querySelector('.settings-message'); if (m) m.textContent = 'Unsaved changes.';
        };
        const form = root.querySelector('.settings-columns');
        form.addEventListener('input', onEdit);
        form.addEventListener('change', onEdit);
    }

    async function save() {
        if (!S.P) return;
        await guard(async () => {
            await api.writeJson(FILE, site());
            S.dirtyFiles.delete(FILE);
            renderTabs(); renderExplorer(); renderStatus();
            const m = $('#v-settings .settings-message'); if (m) m.textContent = 'Settings saved.';
            toast('Settings saved');
        });
    }

    return { render, save };
})();
