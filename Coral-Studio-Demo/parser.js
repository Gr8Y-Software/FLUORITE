/*!
 * md2html — Markdown → HTML converter (CommonMark/GFM-style), zero dependencies.
 *
 * Supports:
 *   Blocks : ATX & Setext headings, paragraphs, blockquotes (nested, lazy),
 *            GitHub alerts (> [!NOTE]), ordered/unordered/nested lists (tight/loose),
 *            task lists, fenced & indented code, tables with alignment, horizontal rules,
 *            link reference definitions, footnotes, YAML front matter, raw HTML blocks (opt-in),
 *            card containers (::: card ... :::), rendered as a responsive grid of cards
 *   Inline : strong, emphasis, strikethrough, code spans, links, images, reference links,
 *            autolinks (<url>, <email>, bare URLs), backslash escapes, hard line breaks
 *   Extras : auto heading ids + table of contents, dir="auto" for RTL/LTR mixing (Arabic-friendly),
 *            syntax-highlight hook, XSS-safe by default (escapes raw HTML, filters dangerous URLs)
 *
 * Usage:
 *   const html = markdownToHTML("# Hello **world**");
 *   const { html, toc, frontMatter } = markdownToHTML.render(md, { externalLinks: true });
 *
 * Works in browsers (global `markdownToHTML`), Node (CommonJS) and bundlers.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.markdownToHTML = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Options
   * ------------------------------------------------------------------ */
  const DEFAULTS = {
    sanitize: true,          // escape raw HTML and block javascript:/data: URLs
    gfm: true,               // tables, strikethrough, task lists, bare-URL autolinks
    breaks: false,           // treat single newlines as <br>
    headingIds: true,        // add id="" to headings
    headingIdPrefix: '',     // prefix for heading ids
    dir: 'auto',             // adds dir="auto" to blocks ('' to disable)
    footnotes: true,         // [^1] footnotes
    frontMatter: true,       // strip leading --- YAML --- block (returned by render())
    externalLinks: false,    // target=_blank rel="noopener noreferrer" on http(s) links
    lazyImages: true,        // loading="lazy" on images
    highlight: null          // (code, lang) => html string (trusted output)
  };

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
  // text escaping that keeps valid entities such as &copy; or &#169;
  const escText = s => String(s)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const normLabel = s => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const fnId = id => id.replace(/[^\p{L}\p{N}_-]/gu, '-');
  const dirAttr = opt => (opt.dir ? ` dir="${esc(opt.dir)}"` : '');

  const slugify = html => html
    .replace(/<[^>]+>/g, '')
    .replace(/&[#\w]+;/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

  const textOf = html => html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');

  function safeUrl(url, opt, isImg) {
    url = String(url).trim();
    if (!opt.sanitize) return url;
    const probe = url.replace(/[\u0000-\u0020\u00ad]/g, '').toLowerCase();
    const m = /^([a-z][a-z0-9+.-]*):/.exec(probe);
    if (!m) return url;                                   // relative / anchor
    if (['http', 'https', 'mailto', 'tel', 'ftp'].includes(m[1])) return url;
    if (isImg && /^data:image\/(png|jpe?g|gif|webp|avif);/.test(probe)) return url;
    return '#';
  }

  /* ------------------------------------------------------------------ *
   * Block-level regexes
   * ------------------------------------------------------------------ */
  const RE = {
    blank: /^\s*$/,
    fence: /^( {0,3})(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$/,
    atx: /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/,
    hr: /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
    quote: /^ {0,3}>/,
    list: /^( {0,3})([*+-]|\d{1,9}[.)])( +|$)(.*)$/,
    setext: /^ {0,3}(=+|-+)[ \t]*$/,
    tableSep: /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/,
    cardOpen: /^ {0,3}:::[ \t]*card[ \t]*$/i,   // ::: card
    cardClose: /^ {0,3}:::[ \t]*$/               // :::
  };
  const HTML_BLOCK = /^ {0,3}<(?:\/?(?:address|article|aside|audio|blockquote|details|dialog|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|iframe|main|nav|ol|p|pre|section|summary|table|tbody|td|th|thead|tr|ul|li|video|script|style)(?:\s|\/?>|$)|!--)/i;

  function isInterrupt(l, opt) {
    if (RE.fence.test(l) || RE.atx.test(l) || RE.hr.test(l) || RE.quote.test(l)) return true;
    if (RE.cardOpen.test(l) || RE.cardClose.test(l)) return true;
    const m = RE.list.exec(l);
    if (m && m[4].trim() !== '' && (!/\d/.test(m[2]) || /^1[.)]$/.test(m[2]))) return true;
    if (!opt.sanitize && HTML_BLOCK.test(l)) return true;
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Preprocessing: normalise text, extract front matter, reference
   * definitions and footnote definitions (outside code fences).
   * ------------------------------------------------------------------ */
  function preprocess(src, env, opt) {
    src = src
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0002]/g, '\uFFFD'); // reserved for internal placeholders

    if (opt.frontMatter) {
      const fm = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(src);
      if (fm) { env.meta = fm[1]; src = src.slice(fm[0].length); }
    }

    const lines = src.split('\n').map(l => l.replace(/^[ \t]+/, ws => ws.replace(/\t/g, '    ')));
    const kept = [];
    let fence = null, m;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];

      if (fence) {
        kept.push(l);
        if (new RegExp('^ {0,3}' + fence.ch + '{' + fence.n + ',}[ \\t]*$').test(l)) fence = null;
        continue;
      }
      if ((m = /^ {0,3}(`{3,}|~{3,})/.exec(l))) {
        fence = { ch: m[1][0], n: m[1].length };
        kept.push(l);
        continue;
      }

      if (opt.footnotes && (m = /^ {0,3}\[\^([^\]\s]+)\]:[ ]?(.*)$/.exec(l))) {
        const buf = [m[2]];
        while (i + 1 < lines.length &&
              (/^ {4}/.test(lines[i + 1]) ||
              (lines[i + 1].trim() === '' && /^ {4}/.test(lines[i + 2] || '')))) {
          i++;
          buf.push(lines[i].replace(/^ {1,4}/, ''));
        }
        env.footnotes[m[1].toLowerCase()] = buf.join('\n').trim();
        continue;
      }

      if ((m = /^ {0,3}\[(?!\^)((?:[^\]\\]|\\.)+)\]:[ \t]*(<[^>]*>|\S+)(?:[ \t]+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\((?:[^)\\]|\\.)*\)))?[ \t]*$/.exec(l))) {
        const key = normLabel(m[1]);
        if (!env.refs[key]) env.refs[key] = { href: m[2].replace(/^<|>$/g, ''), title: m[3] ? m[3].slice(1, -1) : '' };
        continue;
      }

      kept.push(l);
    }
    return kept.join('\n');
  }

  /* ------------------------------------------------------------------ *
   * Block renderers
   * ------------------------------------------------------------------ */
  function renderCode(code, lang, opt) {
    let body;
    if (opt.highlight && lang) {
      try { body = opt.highlight(code, lang); } catch (e) { body = null; }
    }
    if (body == null) body = esc(code);
    const cls = lang ? ` class="language-${esc(lang)}"` : '';
    return `<pre><code${cls}>${body}${code === '' ? '' : '\n'}</code></pre>`;
  }

  function renderHeading(level, text, env, opt) {
    const html = inline(text, env, opt);
    let id = '';
    const base = slugify(html) || 'section';
    if (opt.headingIds) {
      const key = opt.headingIdPrefix + base;
      const n = env.slugs[key] = (env.slugs[key] === undefined ? -1 : env.slugs[key]) + 1;
      id = n ? `${key}-${n}` : key;
    }
    env.toc.push({ level, text: textOf(html).trim(), id });
    return `<h${level}${id ? ` id="${esc(id)}"` : ''}${dirAttr(opt)}>${html}</h${level}>`;
  }

  function splitRow(row) {
    row = row.trim();
    if (row[0] === '|') row = row.slice(1);
    if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
    return row.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  }

  function renderTable(head, aligns, rows, env, opt) {
    const dir = dirAttr(opt);
    const cell = (tag, c, k) => {
      const al = aligns[k] ? ` style="text-align:${aligns[k]}"` : '';
      return `<${tag}${al}${dir}>${inline(c, env, opt)}</${tag}>`;
    };
    let html = '<table>\n<thead>\n<tr>' + head.map((c, k) => cell('th', c, k)).join('') + '</tr>\n</thead>\n';
    if (rows.length) {
      html += '<tbody>\n' + rows.map(r => '<tr>' + r.map((c, k) => cell('td', c, k)).join('') + '</tr>').join('\n') + '\n</tbody>\n';
    }
    return html + '</table>';
  }

  function parseList(lines, i, env, opt) {
    const first = RE.list.exec(lines[i]);
    const ordered = /\d/.test(first[2]);
    const typeOf = s => s.slice(-1);
    const type = typeOf(first[2]);
    const start = ordered ? parseInt(first[2], 10) : 1;
    const items = [];
    let loose = false;

    while (i < lines.length) {
      const mm = RE.list.exec(lines[i]);
      if (!mm || RE.hr.test(lines[i]) || typeOf(mm[2]) !== type) break;

      let sp = mm[3].length;
      let content = mm[4];
      if (sp === 0 || sp > 4) { if (sp > 4) content = ' '.repeat(sp - 1) + content; sp = 1; }
      const cIndent = mm[1].length + mm[2].length + sp;

      const buf = [content];
      i++;
      let blank = false, itemLoose = false;

      while (i < lines.length) {
        const l = lines[i];
        if (RE.blank.test(l)) { buf.push(''); blank = true; i++; continue; }
        const ind = l.match(/^ */)[0].length;
        if (ind >= cIndent) {
          const s = l.slice(cIndent);
          if (blank && !/^ /.test(s) && !RE.list.test(s)) itemLoose = true;
          buf.push(s); blank = false; i++; continue;
        }
        if (blank) break;                                   // item ended
        if (RE.list.test(l) || isInterrupt(l, opt)) break;  // sibling / outer block
        buf.push(l.trim()); i++;                            // lazy continuation
      }

      const trailingBlank = blank;
      while (buf.length && buf[buf.length - 1] === '') buf.pop();
      if (trailingBlank && i < lines.length) {
        const nx = RE.list.exec(lines[i]);
        if (nx && !RE.hr.test(lines[i]) && typeOf(nx[2]) === type) loose = true;
      }
      if (itemLoose) loose = true;
      items.push(buf);
    }

    let hasTask = false;
    const lis = items.map(buf => {
      let text = buf.join('\n'), cb = '', cls = '';
      if (opt.gfm) {
        const t = /^\[([ xX])\](?:[ \t]+|$)/.exec(text);
        if (t) {
          hasTask = true; cls = ' class="task-list-item"';
          cb = `<input type="checkbox" disabled${t[1] !== ' ' ? ' checked' : ''}> `;
          text = text.slice(t[0].length);
        }
      }
      let inner = parseBlocks(text, env, opt, !loose);
      if (cb) inner = /^<p/.test(inner) ? inner.replace(/^(<p[^>]*>)/, (_, p) => p + cb) : cb + inner;
      return loose ? `<li${cls}>\n${inner}</li>` : `<li${cls}>${inner.replace(/\n$/, '')}</li>`;
    });

    const tag = ordered ? 'ol' : 'ul';
    const attrs = (ordered && start !== 1 ? ` start="${start}"` : '') +
                  (hasTask ? ' class="contains-task-list"' : '') + dirAttr(opt);
    return { html: `<${tag}${attrs}>\n${lis.join('\n')}\n</${tag}>`, next: i };
  }

  const ALERT_TITLES = { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution' };

  function parseBlocks(src, env, opt, tight) {
    const lines = src.split('\n');
    const out = [];
    const dir = dirAttr(opt);
    let i = 0, m;

    while (i < lines.length) {
      const line = lines[i];
      if (RE.blank.test(line)) { i++; continue; }

      // fenced code
      if ((m = RE.fence.exec(line))) {
        const ind = m[1].length, ch = m[2][0], len = m[2].length, lang = m[3];
        const close = new RegExp('^ {0,3}' + ch + '{' + len + ',}[ \\t]*$');
        const strip = new RegExp('^ {0,' + ind + '}');
        const buf = [];
        i++;
        while (i < lines.length && !close.test(lines[i])) { buf.push(lines[i].replace(strip, '')); i++; }
        i++;
        out.push(renderCode(buf.join('\n'), lang, opt));
        continue;
      }

      // indented code
      if (/^ {4}/.test(line)) {
        const buf = [];
        while (i < lines.length && (/^ {4}/.test(lines[i]) || RE.blank.test(lines[i]))) { buf.push(lines[i].slice(4)); i++; }
        while (buf.length && RE.blank.test(buf[buf.length - 1])) buf.pop();
        out.push(renderCode(buf.join('\n'), '', opt));
        continue;
      }

      // ATX heading
      if ((m = RE.atx.exec(line))) {
        out.push(renderHeading(m[1].length, (m[2] || '').trim(), env, opt));
        i++; continue;
      }

      // card containers:  ::: card  ...  :::   (consecutive cards form one grid)
      if (RE.cardOpen.test(line)) {
        const cards = [];
        while (i < lines.length && RE.cardOpen.test(lines[i])) {
          const buf = [];
          i++;
          while (i < lines.length && !RE.cardClose.test(lines[i])) { buf.push(lines[i]); i++; }
          i++; // skip the closing :::
          cards.push(`<div class="md-card">\n${parseBlocks(buf.join('\n'), env, opt)}</div>`);
          let j = i;
          while (j < lines.length && RE.blank.test(lines[j])) j++; // blank lines between cards
          if (j < lines.length && RE.cardOpen.test(lines[j])) i = j; else break;
        }
        out.push(`<div class="md-cards">\n${cards.join('\n')}\n</div>`);
        continue;
      }

      // horizontal rule
      if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }

      // blockquote / alerts
      if (RE.quote.test(line)) {
        const buf = [];
        while (i < lines.length) {
          const l = lines[i];
          if (RE.quote.test(l)) { buf.push(l.replace(/^ {0,3}> ?/, '')); i++; }
          else if (!RE.blank.test(l) && buf.length && !RE.blank.test(buf[buf.length - 1]) && !isInterrupt(l, opt)) { buf.push(l); i++; }
          else break;
        }
        const al = opt.gfm && /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/i.exec(buf[0] || '');
        if (al) {
          const kind = al[1].toLowerCase();
          out.push(`<div class="markdown-alert markdown-alert-${kind}"${dir}>\n<p class="markdown-alert-title">${ALERT_TITLES[kind]}</p>\n${parseBlocks(buf.slice(1).join('\n'), env, opt)}</div>`);
        } else {
          out.push(`<blockquote${dir}>\n${parseBlocks(buf.join('\n'), env, opt)}</blockquote>`);
        }
        continue;
      }

      // lists
      if (RE.list.test(line)) {
        const r = parseList(lines, i, env, opt);
        out.push(r.html); i = r.next;
        continue;
      }

      // tables
      if (opt.gfm && line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') &&
          RE.tableSep.test(lines[i + 1])) {
        const head = splitRow(line), seps = splitRow(lines[i + 1]);
        if (head.length === seps.length) {
          const aligns = seps.map(c => {
            const l = c.startsWith(':'), r = c.endsWith(':');
            return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
          });
          i += 2;
          const rows = [];
          while (i < lines.length && !RE.blank.test(lines[i]) && !isInterrupt(lines[i], opt)) {
            const cells = splitRow(lines[i]);
            while (cells.length < head.length) cells.push('');
            rows.push(cells.slice(0, head.length));
            i++;
          }
          out.push(renderTable(head, aligns, rows, env, opt));
          continue;
        }
      }

      // raw HTML block (only when sanitize is off)
      if (!opt.sanitize && HTML_BLOCK.test(line)) {
        const buf = [];
        while (i < lines.length && !RE.blank.test(lines[i])) buf.push(lines[i++]);
        out.push(buf.join('\n'));
        continue;
      }

      // paragraph / setext heading
      const buf = [line.replace(/^ +/, '')];
      i++;
      let done = false;
      while (i < lines.length && !RE.blank.test(lines[i])) {
        const l = lines[i];
        if ((m = RE.setext.exec(l))) {
          out.push(renderHeading(m[1][0] === '=' ? 1 : 2, buf.join(' ').trim(), env, opt));
          i++; done = true; break;
        }
        if (isInterrupt(l, opt)) break;
        buf.push(l.replace(/^ +/, '')); i++;
      }
      if (done) continue;
      const html = inline(buf.join('\n').replace(/\s+$/, ''), env, opt);
      out.push(tight ? html : `<p${dir}>${html}</p>`);
    }

    return out.length ? out.join('\n') + '\n' : '';
  }

  /* ------------------------------------------------------------------ *
   * Inline parser
   *   Strategy: pull out "atomic" constructs (escapes, code spans, links,
   *   images, autolinks, raw HTML) into a placeholder stash, escape the rest,
   *   apply emphasis, then restore the stash.
   * ------------------------------------------------------------------ */
  const PH = /\u0001(\d+)\u0002/g;
  const restore = (s, stash) => {
    while (/\u0001\d+\u0002/.test(s)) s = s.replace(PH, (_, n) => stash[+n]);
    return s;
  };

  function inline(text, env, opt) {
    const stash = [];
    return restore(inlineInner(text, env, opt, stash), stash);
  }

  function linkHtml(href, title, innerHtml, opt) {
    const h = safeUrl(href, opt, false);
    let a = `<a href="${esc(h)}"`;
    if (title) a += ` title="${esc(title)}"`;
    if (opt.externalLinks && /^https?:/i.test(h)) a += ' target="_blank" rel="noopener noreferrer"';
    return `${a}>${innerHtml}</a>`;
  }

  function imageHtml(src, title, altHtml, opt) {
    const alt = altHtml.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;');
    let t = `<img src="${esc(safeUrl(src, opt, true))}" alt="${alt}"`;
    if (title) t += ` title="${esc(title)}"`;
    if (opt.lazyImages) t += ' loading="lazy"';
    return t + '>';
  }

  function inlineInner(text, env, opt, stash) {
    const put = html => '\u0001' + (stash.push(html) - 1) + '\u0002';
    const rec = t => inlineInner(t, env, opt, stash);

    // 1) backslash escapes + code spans (single pass so the leftmost construct wins)
    text = text.replace(/\\(\n|[!-\/:-@\[-`{-~])|(`+)(?!`)([\s\S]*?[^`])\2(?!`)/g, (m, c, ticks, code) => {
      if (c !== undefined) return put(c === '\n' ? '<br>\n' : esc(c));
      code = code.replace(/\n/g, ' ');
      if (/^ .* $/.test(code) && /[^ ]/.test(code)) code = code.slice(1, -1);
      return put('<code>' + esc(code) + '</code>');
    });

    // 2) footnote references
    if (opt.footnotes) {
      text = text.replace(/\[\^([^\]\s]+)\]/g, (m, raw) => {
        const id = raw.toLowerCase();
        if (!(id in env.footnotes)) return m;
        let n = env.fnOrder.indexOf(id) + 1;
        if (!n) n = env.fnOrder.push(id);
        return put(`<sup class="footnote-ref"><a href="#fn-${fnId(id)}" id="fnref-${fnId(id)}">${n}</a></sup>`);
      });
    }

    // 3) inline links and images
    text = text.replace(
      /(!?)\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(\s*(<[^<>\n]*>|(?:[^\s()]|\([^\s()]*\))*)(?:\s+("[^"]*"|'[^']*'))?\s*\)/g,
      (m, bang, label, href, title) => {
        href = href.replace(/^<|>$/g, '');
        title = title ? title.slice(1, -1) : '';
        return put(bang ? imageHtml(href, title, restore(rec(label), stash), opt)
                        : linkHtml(href, title, rec(label), opt));
      });

    // 4) reference links / images
    text = text.replace(/(!?)\[((?:[^\[\]]|\[[^\[\]]*\])*)\](?:\[([^\[\]]*)\])?/g, (m, bang, label, ref) => {
      const def = env.refs[normLabel(ref ? ref : label)];
      if (!def) return m;
      return put(bang ? imageHtml(def.href, def.title, restore(rec(label), stash), opt)
                      : linkHtml(def.href, def.title, rec(label), opt));
    });

    // 5) autolinks
    text = text.replace(/<((?:https?|ftp|mailto):[^\s<>]*)>/gi, (m, u) => put(linkHtml(u, '', esc(u), opt)));
    text = text.replace(/<([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/g, (m, e) => put(linkHtml('mailto:' + e, '', esc(e), opt)));
    if (opt.gfm) {
      text = text.replace(/(^|[\s(>])((?:https?:\/\/|www\.)[^\s<]*[^\s<?!.,:*_~'")\]])/g, (m, pre, u) =>
        pre + put(linkHtml(/^www\./i.test(u) ? 'http://' + u : u, '', esc(u), opt)));
    }

    // 6) raw inline HTML (only if sanitize is off); otherwise it gets escaped below
    if (!opt.sanitize) {
      text = text.replace(/<\/?[a-zA-Z][^<>]*>|<!--[\s\S]*?-->/g, m => put(m));
    }

    // 7) escape everything that's left
    text = escText(text);

    // 8) emphasis
    const W = '[\\p{L}\\p{N}_]';
    
    // GFM strikethrough
    if (opt.gfm) text = text.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

    // strong + emphasis
    const NW = '(?!' + W + ')[\\s\\S]';

    text = text.replace(/\*\*\*(?=[^\s*])([\s\S]*?[^\s*])\*\*\*/g, '<em><strong>$1</strong></em>');
    text = text.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    text = text.replace(
      new RegExp('(^|' + NW + ')__(?=\\S)([\\s\\S]*?\\S)__(?!' + W + ')', 'gu'),
      '$1<strong>$2</strong>'
    );
    text = text.replace(/\*(?=[^\s*])([\s\S]*?[^\s*])\*(?!\*)/g, '<em>$1</em>');
    text = text.replace(
      new RegExp('(^|' + NW + ')_(?=[^\\s_])([\\s\\S]*?[^\\s_])_(?!' + W + ')', 'gu'),
      '$1<em>$2</em>'
    );

    // hard line breaks
    text = text.replace(/ {2,}\n/g, '<br>\n');

    if (opt.breaks) {
      text = text.replace(/(<br>)?\n/g, (m, br) => br ? m : '<br>\n');
    }

    return text;
  }

  /* ------------------------------------------------------------------ *
   * Footnotes section
   * ------------------------------------------------------------------ */
  function renderFootnotes(env, opt) {
    if (!env.fnOrder.length) return '';

    const items = env.fnOrder.map(id => {
      const back = ' <a href="#fnref-' + fnId(id) +
        '" class="footnote-backref" aria-label="Back to reference">\u21a9</a>';

      let body = parseBlocks(env.footnotes[id], env, opt, false)
        .replace(/\s+$/, '');

      body = /<\/p>$/.test(body)
        ? body.replace(/<\/p>$/, back + '</p>')
        : body + back;

      return '<li id="fn-' + fnId(id) + '">\n' +
        body + '\n</li>';
    });

    return '<section class="footnotes"' + dirAttr(opt) +
      '>\n<hr>\n<ol>\n' + items.join('\n') +
      '\n</ol>\n</section>\n';
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */
  function render(md, options) {
    const opt = Object.assign({}, DEFAULTS, options || {});

    const env = {
      meta: null,
      refs: {},
      footnotes: {},
      fnOrder: [],
      slugs: {},
      toc: []
    };

    const src = preprocess(String(md == null ? '' : md), env, opt);

    let html = parseBlocks(src, env, opt, false);

    if (opt.footnotes) {
      html += renderFootnotes(env, opt);
    }

    return {
      html,
      toc: env.toc,
      frontMatter: env.meta
    };
  }

  function markdownToHTML(md, options) {
    return render(md, options).html;
  }

  markdownToHTML.render = render;
  markdownToHTML.defaults = DEFAULTS;

  return markdownToHTML;
});
        
