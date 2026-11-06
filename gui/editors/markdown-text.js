'use strict';
/* Markdown parser bridge and safe HTML/source conversion for the standalone Markdown studio. */
window.MarkdownText = (() => {
    const safeTags = new Set(['P','DIV','H1','H2','H3','H4','H5','H6','STRONG','B','EM','I','S','DEL','U','UL','OL','LI','BLOCKQUOTE','PRE','CODE','A','IMG','HR','BR','TABLE','THEAD','TBODY','TR','TH','TD']);
    function sanitize(html) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        const clean = (node) => {
            if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue);
            if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
            if (!safeTags.has(node.tagName)) { const f = document.createDocumentFragment(); [...node.childNodes].forEach((c) => f.append(clean(c))); return f; }
            const out = document.createElement(node.tagName.toLowerCase());
            if (node.tagName === 'A') {
                const href = node.getAttribute('href') || '';
                if (!/^(https?:|mailto:|\/|#|\.\.?\/)/i.test(href)) return document.createTextNode(node.textContent);
                out.href = href; out.target = '_blank'; out.rel = 'noopener noreferrer';
            }
            if (node.tagName === 'IMG') {
                const src = node.getAttribute('src') || '';
                if (!/^(https?:|\/|\.\.?\/)/i.test(src)) return document.createDocumentFragment();
                out.src = src; out.alt = node.getAttribute('alt') || '';
            }
            if (node.tagName === 'TH' || node.tagName === 'TD') for (const a of ['colspan','rowspan']) if (node.hasAttribute(a)) out.setAttribute(a, node.getAttribute(a));
            [...node.childNodes].forEach((c) => out.append(clean(c)));
            return out;
        };
        const frag = document.createDocumentFragment(); [...doc.body.childNodes].forEach((n) => frag.append(clean(n))); return frag;
    }
    async function toHtml(markdown) {
        const tokens = [];
        const source = String(markdown || '').replace(/\{\{\s*site\.[\w.]+\s*\}\}/g, (match) => { const marker = `MDSITETOKEN${tokens.length}X`; tokens.push([marker, match]); return marker; });
        const fragment = sanitize(await api.renderMd(source));
        const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT); let node;
        while ((node = walker.nextNode())) for (const [marker, token] of tokens) node.nodeValue = node.nodeValue.replaceAll(marker, token);
        return fragment;
    }
    function inline(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const tokens = [];
            const protectedText = node.nodeValue.replace(/\{\{\s*site\.[\w.]+\s*\}\}/g, (match) => { const key = `MDSITETOKEN${tokens.length}X`; tokens.push([key, match]); return key; });
            let text = protectedText.replace(/([\\`*\[\]<>])/g, '\\$1');
            for (const [key, token] of tokens) text = text.replace(key, token);
            return text;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName, content = [...node.childNodes].map(inline).join('');
        if (tag === 'BR') return '\n';
        if (tag === 'STRONG' || tag === 'B') return `**${content}**`;
        if (tag === 'EM' || tag === 'I') return `*${content}*`;
        if (tag === 'S' || tag === 'DEL') return `~~${content}~~`;
        if (tag === 'CODE') return `\`${node.textContent}\``;
        if (tag === 'A') return `[${content}](${node.getAttribute('href') || ''})`;
        if (tag === 'IMG') return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
        return content;
    }
    function block(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.trim() ? inline(node) : '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName;
        if (/^H[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${inline(node).trim()}`;
        if (tag === 'PRE') return `\`\`\`\n${node.textContent.replace(/^\n+|\n+$/g, '')}\n\`\`\``;
        if (tag === 'BLOCKQUOTE') return blocks(node).split('\n').map((line) => `> ${line}`).join('\n');
        if (tag === 'UL' || tag === 'OL') return [...node.children].map((li, i) => `${tag === 'OL' ? `${i + 1}.` : '-'} ${blocks(li).replace(/\n/g, '\n  ')}`).join('\n');
        if (tag === 'LI') return blocks(node);
        if (tag === 'HR') return '---';
        if (tag === 'TABLE') {
            const rows = [...node.querySelectorAll('tr')].map((tr) => [...tr.children].map((cell) => inline(cell).trim()));
            if (!rows.length) return '';
            const header = `| ${rows[0].join(' | ')} |`, separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
            return [header, separator, ...rows.slice(1).map((row) => `| ${row.join(' | ')} |`)].join('\n');
        }
        return ['P','DIV','TR','TH','TD'].includes(tag) ? blocks(node).trim() : inline(node).trim();
    }
    function blocks(node) { return [...node.childNodes].map(block).filter(Boolean).join('\n\n'); }
    function toMarkdown(html) { return blocks(new DOMParser().parseFromString(html, 'text/html').body).replace(/\n{3,}/g, '\n\n').trim() + '\n'; }
    return { sanitize, toHtml, toMarkdown };
})();
