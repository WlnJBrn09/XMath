(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MathModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const GREEK = { alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',varepsilon:'ϵ',theta:'θ',lambda:'λ',mu:'μ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',phi:'φ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Omega:'Ω' };
  const COMMANDS = { times:'×',cdot:'·',pm:'±',mp:'∓',div:'÷',leq:'≤',geq:'≥',neq:'≠',approx:'≈',infty:'∞',partial:'∂',nabla:'∇',rightarrow:'→',leftarrow:'←',leftrightarrow:'↔',in:'∈',notin:'∉',subset:'⊂',subseteq:'⊆',cup:'∪',cap:'∩',forall:'∀',exists:'∃',sum:'∑',prod:'∏',int:'∫',oint:'∮',lim:'lim',sin:'sin',cos:'cos',tan:'tan',log:'log',ln:'ln' };
  function blank() { return { source: 'E = mc^{2}', mode: 'tex', size: 38 }; }
  function normalize(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Invalid formula document');
    return { source: String(source.source ?? '').slice(0, 100000), mode: ['tex','starmath','mathml'].includes(source.mode) ? source.mode : 'tex', size: Math.max(16, Math.min(100, Number(source.size) || 38)) };
  }
  function starToTex(text) {
    return text
      .replace(/\%([A-Za-z]+)/g, (_, name) => `\\${name}`)
      .replace(/\b(?:sqrt)\s*(\{[^{}]*\}|[A-Za-z0-9]+)/g, (_, term) => `\\sqrt${term.startsWith('{') ? term : `{${term}}`}`)
      .replace(/(\{[^{}]*\}|[A-Za-z0-9]+)\s+over\s+(\{[^{}]*\}|[A-Za-z0-9]+)/g, (_, top, bottom) => `\\frac${top.startsWith('{') ? top : `{${top}}`}${bottom.startsWith('{') ? bottom : `{${bottom}}`}`)
      .replace(/\b(sum|prod|int)\s+from\s+(\{[^{}]*\}|\S+)\s+to\s+(\{[^{}]*\}|\S+)/g, (_, op, low, high) => `\\${op}_${low.startsWith('{') ? low : `{${low}}`}^{${high.replace(/^\{|\}$/g, '')}}`)
      .replace(/(?<!\\)\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|omega|times|cdot|leq|geq|neq|infty|sum|prod|int)\b/g, (_, command) => `\\${command}`);
  }
  function texToMathML(source) {
    const input = source.slice(0, 100000);
    let pos = 0, depth = 0;
    const tag = (name, child) => `<${name}>${child}</${name}>`;
    const grouped = () => {
      while (/\s/.test(input[pos] || '') && pos < input.length) pos++;
      if (input[pos] === '{') { pos++; const body = sequence('}'); if (input[pos] !== '}') throw new Error('Missing closing brace'); pos++; return tag('mrow', body); }
      return atom();
    };
    const atom = () => {
      if (++depth > 100) throw new Error('Formula is nested too deeply');
      while (/\s/.test(input[pos] || '') && pos < input.length) pos++;
      if (pos >= input.length) { depth--; return '<mrow></mrow>'; }
      const ch = input[pos++];
      let out;
      if (ch === '{') { const body = sequence('}'); if (input[pos] !== '}') throw new Error('Missing closing brace'); pos++; out = tag('mrow', body); }
      else if (ch === '\\') {
        let command = ''; while (/[A-Za-z]/.test(input[pos] || '')) command += input[pos++];
        if (!command) { const next = input[pos++] || ''; out = tag('mo', esc(next)); }
        else if (command === 'frac') { const top = grouped(), bottom = grouped(); out = `<mfrac>${top}${bottom}</mfrac>`; }
        else if (command === 'sqrt') { const body = grouped(); out = tag('msqrt', body); }
        else if (command === 'text') { while (/\s/.test(input[pos] || '')) pos++; if (input[pos++] !== '{') throw new Error('Expected text group'); let value = ''; while (pos < input.length && input[pos] !== '}') value += input[pos++]; if (input[pos++] !== '}') throw new Error('Missing closing brace'); out = tag('mtext', esc(value)); }
        else if (command === 'left' || command === 'right') out = tag('mo', esc(input[pos++] || ''));
        else if (GREEK[command]) out = tag('mi', GREEK[command]);
        else if (COMMANDS[command]) out = tag(['lim','sin','cos','tan','log','ln'].includes(command) ? 'mi' : 'mo', COMMANDS[command]);
        else throw new Error(`Unknown command: \\${command}`);
      }
      else if (/[0-9]/.test(ch)) { let value = ch; while (/[0-9.]/.test(input[pos] || '')) value += input[pos++]; out = tag('mn', esc(value)); }
      else if (/[A-Za-z]/.test(ch)) out = tag('mi', esc(ch));
      else out = tag('mo', esc(ch));
      depth--; return out;
    };
    const sequence = stop => {
      const nodes = [];
      while (pos < input.length && input[pos] !== stop) {
        if (input[pos] === '}') throw new Error('Unexpected closing brace');
        if (/\s/.test(input[pos])) { pos++; continue; }
        if (input[pos] === '^' || input[pos] === '_') {
          if (!nodes.length) throw new Error('A script needs a base symbol');
          const marker = input[pos++], script = grouped();
          if (marker === '^') nodes[nodes.length - 1].sup = script;
          else nodes[nodes.length - 1].sub = script;
        } else nodes.push({ base: atom(), sub: null, sup: null });
      }
      return nodes.map(node => {
        if (node.sub && node.sup) return `<msubsup>${node.base}${node.sub}${node.sup}</msubsup>`;
        if (node.sub) return `<msub>${node.base}${node.sub}</msub>`;
        if (node.sup) return `<msup>${node.base}${node.sup}</msup>`;
        return node.base;
      }).join('');
    };
    const body = sequence('\0');
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow>${body}</mrow></math>`;
  }
  const MATH_TAGS = new Set(['math','mrow','mi','mn','mo','mtext','mfrac','msqrt','mroot','msup','msub','msubsup','mover','munder','munderover','mtable','mtr','mtd','mspace','mfenced','menclose','semantics','mstyle','mpadded']);
  function sanitizeMathML(source) {
    if (typeof DOMParser === 'undefined') throw new Error('MathML needs a browser parser');
    const parsed = new DOMParser().parseFromString(source, 'application/xml');
    if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'math') throw new Error('Invalid MathML document');
    function walk(node) {
      if (node.nodeType === 3) return esc(node.textContent);
      if (node.nodeType !== 1 || (node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1998/Math/MathML')) return '';
      const name = node.localName;
      if (name === 'annotation' || name === 'annotation-xml') return '';
      const children = Array.from(node.childNodes).map(walk).join('');
      if (!MATH_TAGS.has(name)) return children;
      const attrs = name === 'math' ? ' xmlns="http://www.w3.org/1998/Math/MathML" display="block"' : '';
      return `<${name}${attrs}>${children}</${name}>`;
    }
    return walk(parsed.documentElement);
  }
  function toMathML(document) {
    const d = normalize(document);
    if (d.mode === 'mathml') return sanitizeMathML(d.source);
    return texToMathML(d.mode === 'starmath' ? starToTex(d.source) : d.source);
  }
  function toSvg(document) {
    const d = normalize(document);
    const mathml = toMathML(d);
    const size = d.size;
    const textLayout = (value, fontSize) => {
      const text = String(value ?? '');
      const width = Array.from(text).reduce((sum, char) => sum + fontSize * (/[il1.,]/.test(char) ? .32 : /[MW∑∫∏]/.test(char) ? .9 : .58), 0);
      return { width, ascent: fontSize * .8, descent: fontSize * .23,
        draw: (x, y) => `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="Georgia,Times New Roman,serif" font-size="${fontSize.toFixed(2)}" stroke="none" fill="#111111">${esc(text)}</text>` };
    };
    const rowLayout = (children, fontSize) => {
      const items = children.map(child => layout(child, fontSize));
      if (!items.length) return textLayout('', fontSize);
      return { width: items.reduce((sum, item) => sum + item.width, 0),
        ascent: Math.max(...items.map(item => item.ascent)), descent: Math.max(...items.map(item => item.descent)),
        draw: (x, y) => { let offset = 0; return items.map(item => { const svg = item.draw(x + offset, y); offset += item.width; return svg; }).join(''); } };
    };
    const layout = (node, fontSize) => {
      const name = node.localName;
      const children = Array.from(node.children || []);
      if (['mi','mn','mo','mtext'].includes(name)) return textLayout(node.textContent, fontSize);
      if (name === 'mspace') return textLayout(' ', fontSize);
      if (name === 'mfrac' && children.length >= 2) {
        const top = layout(children[0], fontSize * .82), bottom = layout(children[1], fontSize * .82);
        const width = Math.max(top.width, bottom.width) + fontSize * .55;
        const topShift = fontSize * .32 + top.descent;
        const bottomShift = fontSize * .35 + bottom.ascent;
        return { width, ascent: topShift + top.ascent, descent: bottomShift + bottom.descent,
          draw: (x, y) => top.draw(x + (width - top.width) / 2, y - topShift) + bottom.draw(x + (width - bottom.width) / 2, y + bottomShift)
            + `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + width).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#111111" stroke-width="${Math.max(1.4, fontSize * .045).toFixed(2)}"/>` };
      }
      if (name === 'msqrt' || name === 'mroot') {
        const child = name === 'mroot' && children.length ? layout(children[0], fontSize) : rowLayout(children, fontSize);
        const index = name === 'mroot' && children[1] ? layout(children[1], fontSize * .55) : null;
        const left = (index ? index.width : 0) + fontSize * .48;
        const width = left + child.width + fontSize * .12;
        const ascent = Math.max(child.ascent + fontSize * .2, index ? index.ascent + fontSize * .5 : 0);
        return { width, ascent, descent: child.descent,
          draw: (x, y) => (index ? index.draw(x, y - fontSize * .55) : '')
            + `<path d="M ${(x + left - fontSize * .45).toFixed(2)} ${(y - fontSize * .05).toFixed(2)} L ${(x + left - fontSize * .3).toFixed(2)} ${(y + child.descent * .6).toFixed(2)} L ${(x + left - fontSize * .13).toFixed(2)} ${(y - ascent + fontSize * .08).toFixed(2)} L ${(x + width).toFixed(2)} ${(y - ascent + fontSize * .08).toFixed(2)}" fill="none" stroke="#111111" stroke-width="${Math.max(1.5, fontSize * .055).toFixed(2)}" stroke-linejoin="round"/>`
            + child.draw(x + left, y) };
      }
      if (['msup','msub','msubsup'].includes(name) && children.length >= 2) {
        const base = layout(children[0], fontSize), sub = name !== 'msup' ? layout(children[1], fontSize * .68) : null;
        const sup = name !== 'msub' ? layout(children[name === 'msubsup' ? 2 : 1], fontSize * .68) : null;
        const rise = base.ascent * .65, drop = base.descent + fontSize * .4;
        return { width: base.width + Math.max(sub?.width || 0, sup?.width || 0),
          ascent: Math.max(base.ascent, sup ? rise + sup.ascent : 0),
          descent: Math.max(base.descent, sub ? drop + sub.descent : 0),
          draw: (x, y) => base.draw(x, y) + (sub ? sub.draw(x + base.width, y + drop) : '') + (sup ? sup.draw(x + base.width, y - rise) : '') };
      }
      if (['munder','mover','munderover'].includes(name) && children.length >= 2) {
        const base = layout(children[0], fontSize);
        const under = name !== 'mover' ? layout(children[1], fontSize * .7) : null;
        const over = name !== 'munder' ? layout(children[name === 'munderover' ? 2 : 1], fontSize * .7) : null;
        const width = Math.max(base.width, under?.width || 0, over?.width || 0);
        const up = base.ascent + fontSize * .25 + (over?.descent || 0);
        const down = base.descent + fontSize * .25 + (under?.ascent || 0);
        return { width, ascent: Math.max(base.ascent, over ? up + over.ascent : 0), descent: Math.max(base.descent, under ? down + under.descent : 0),
          draw: (x, y) => base.draw(x + (width - base.width) / 2, y)
            + (over ? over.draw(x + (width - over.width) / 2, y - up) : '')
            + (under ? under.draw(x + (width - under.width) / 2, y + down) : '') };
      }
      if (name === 'mtable') {
        const rows = children.map(child => rowLayout(Array.from(child.children), fontSize * .9));
        const width = Math.max(fontSize, ...rows.map(row => row.width));
        const line = fontSize * 1.55;
        const height = rows.length * line;
        return { width, ascent: height / 2, descent: height / 2,
          draw: (x, y) => rows.map((row, i) => row.draw(x + (width - row.width) / 2, y - height / 2 + line * (i + .75))).join('') };
      }
      if (name === 'mfenced') {
        const middle = rowLayout(children, fontSize);
        return { width: middle.width + fontSize * .6, ascent: middle.ascent, descent: middle.descent,
          draw: (x, y) => textLayout('(', fontSize).draw(x, y) + middle.draw(x + fontSize * .3, y)
            + textLayout(')', fontSize).draw(x + fontSize * .3 + middle.width, y) };
      }
      return rowLayout(children, fontSize);
    };
    if (typeof DOMParser === 'undefined') {
      const text = textLayout(d.source, size);
      const width = Math.ceil(text.width + 40), height = Math.ceil(text.ascent + text.descent + 40);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${text.draw(20, 20 + text.ascent)}</svg>`;
    }
    const xml = new DOMParser().parseFromString(mathml, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Could not lay out MathML');
    const formula = layout(xml.documentElement, size);
    const width = Math.max(1, Math.ceil(formula.width + 48));
    const height = Math.max(1, Math.ceil(formula.ascent + formula.descent + 48));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${formula.draw(24, 24 + formula.ascent)}</svg>`;
  }
  return { blank, normalize, starToTex, texToMathML, toMathML, toSvg, sanitizeMathML };
});
