// Tiny markdown renderer — built for speckit artifacts.
// Supports: headings, paragraphs, bold/italic/code/strikethrough, links,
// lists (ul/ol), task-list items [x]/[ ], tables, fenced code,
// blockquotes, hr, HTML comments are dropped.

const MD = (() => {
  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Inline formatter — applied to text after structural parsing.
  function inline(text) {
    // Escape angle brackets first (but allow our markers later).
    let s = escapeHtml(text);
    // Code spans
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold (**foo**) and italic (*foo* or _foo_)
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|\s|\()_([^_\n]+)_/g, '$1<em>$2</em>');
    // Strikethrough
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    // Links [text](href)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  }

  function render(md) {
    if (!md) return '';
    // Strip HTML comments
    md = md.replace(/<!--[\s\S]*?-->/g, '');
    const lines = md.split(/\r?\n/);
    let out = [];
    let i = 0;
    let inCode = false;
    let codeLang = '';
    let codeBuf = [];
    let listStack = []; // each entry: { type: 'ul'|'ol', indent: number }

    function closeLists(toIndent = -1) {
      while (listStack.length && listStack[listStack.length - 1].indent > toIndent) {
        const top = listStack.pop();
        out.push(`</${top.type}>`);
      }
    }

    while (i < lines.length) {
      const raw = lines[i];
      // Fenced code block
      const fence = raw.match(/^```(\w*)\s*$/);
      if (fence) {
        if (inCode) {
          out.push(`<pre><code class="lang-${codeLang}">${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
          inCode = false;
          codeBuf = [];
        } else {
          closeLists();
          inCode = true;
          codeLang = fence[1] || '';
        }
        i++; continue;
      }
      if (inCode) {
        codeBuf.push(raw);
        i++; continue;
      }

      // Frontmatter at top of file
      if (i === 0 && raw.trim() === '---') {
        const end = lines.indexOf('---', 1);
        if (end > 0) {
          const fm = lines.slice(1, end).filter(l => l.trim()).map(inline).join('<br/>');
          out.push(`<div class="md-frontmatter">${fm}</div>`);
          i = end + 1; continue;
        }
      }

      // Headings
      const h = raw.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        closeLists();
        const level = h[1].length;
        const text = h[2].replace(/\s+#*$/, '');
        const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        out.push(`<h${level} id="${slug}">${inline(text)}</h${level}>`);
        i++; continue;
      }

      // HR
      if (/^---+\s*$/.test(raw) || /^\*\*\*+\s*$/.test(raw)) {
        closeLists();
        out.push('<hr/>');
        i++; continue;
      }

      // Blockquote
      if (/^>\s?/.test(raw)) {
        closeLists();
        const block = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          block.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push(`<blockquote>${inline(block.join(' '))}</blockquote>`);
        continue;
      }

      // Tables — header | --- | row...
      if (raw.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i+1])) {
        closeLists();
        const splitRow = (r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
        const header = splitRow(raw);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
          rows.push(splitRow(lines[i]));
          i++;
        }
        out.push('<div class="md-table-wrap"><table><thead><tr>' +
          header.map(c => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }

      // List items
      const ul = raw.match(/^(\s*)[-*+]\s+(.*)$/);
      const ol = raw.match(/^(\s*)\d+\.\s+(.*)$/);
      if (ul || ol) {
        const m = ul || ol;
        const indent = m[1].length;
        const content = m[2];
        const type = ul ? 'ul' : 'ol';

        // Open / close lists based on indent
        while (listStack.length && listStack[listStack.length - 1].indent > indent) {
          const top = listStack.pop();
          out.push(`</${top.type}>`);
        }
        if (!listStack.length || listStack[listStack.length - 1].indent < indent) {
          listStack.push({ type, indent });
          out.push(`<${type}>`);
        }

        // Task list item
        const taskMatch = content.match(/^\[([ xX])\]\s+(.*)$/);
        if (taskMatch) {
          const checked = taskMatch[1].toLowerCase() === 'x';
          // Try parse speckit task pattern: T123 [P] [US1] desc
          const sp = taskMatch[2].match(/^(T\d+\w*)(\s+\[P\])?(\s+\[([^\]]+)\])?\s+(.*)$/);
          if (sp) {
            out.push(`<li class="md-task" data-checked="${checked}">` +
              `<span class="md-check" data-checked="${checked}">${checked ? '✓' : ''}</span>` +
              `<span class="md-tid">${sp[1]}</span>` +
              (sp[2] ? `<span class="md-tag md-tag-p">P</span>` : '') +
              (sp[4] ? `<span class="md-tag md-tag-story">${sp[4]}</span>` : '') +
              `<span class="md-tdesc">${inline(sp[5])}</span>` +
              `</li>`);
          } else {
            out.push(`<li class="md-task" data-checked="${checked}">` +
              `<span class="md-check" data-checked="${checked}">${checked ? '✓' : ''}</span>` +
              `<span class="md-tdesc">${inline(taskMatch[2])}</span></li>`);
          }
        } else {
          out.push(`<li>${inline(content)}</li>`);
        }
        i++; continue;
      } else {
        closeLists();
      }

      // Blank line — paragraph break
      if (raw.trim() === '') {
        i++; continue;
      }

      // Paragraph — collect contiguous non-empty, non-special lines
      const para = [raw];
      i++;
      while (i < lines.length && lines[i].trim() !== '' &&
        !/^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+\.\s|---+\s*$)/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push(`<p>${inline(para.join(' '))}</p>`);
    }
    if (inCode) {
      out.push(`<pre><code class="lang-${codeLang}">${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
    }
    closeLists();
    return out.join('\n');
  }

  return { render };
})();

window.MD = MD;
