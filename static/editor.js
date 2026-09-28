(() => {
  'use strict';
  const M = window.MathModel;
  const $ = id => document.getElementById(id);
  let data = M.blank(), changed = () => {}, lastCheckpoint = 0;
  const undo = [], redo = [];
  const symbols = [
    ['α','\\alpha'],['β','\\beta'],['γ','\\gamma'],['δ','\\delta'],['θ','\\theta'],['λ','\\lambda'],['π','\\pi'],['σ','\\sigma'],
    ['φ','\\phi'],['ω','\\omega'],['∞','\\infty'],['±','\\pm'],['×','\\times'],['·','\\cdot'],['≤','\\leq'],['≥','\\geq'],
    ['≠','\\neq'],['≈','\\approx'],['→','\\rightarrow'],['∂','\\partial'],['∇','\\nabla'],['∑','\\sum'],['∏','\\prod'],['∫','\\int'],
  ];
  function checkpoint() { undo.push(JSON.stringify(data)); if (undo.length > 100) undo.shift(); redo.length = 0; }
  function mark() { changed(); }
  function renderPreview() {
    const preview = $('math-preview');
    preview.style.fontSize = `${data.size}px`;
    try {
      preview.innerHTML = M.toMathML(data);
      $('math-error').textContent = '';
    } catch (error) {
      preview.replaceChildren();
      $('math-error').textContent = error.message;
    }
  }
  function render() {
    $('math-source').value = data.source;
    $('input-mode').value = data.mode;
    $('math-size').value = data.size;
    renderPreview();
  }
  function blank() { data = M.blank(); undo.length = 0; redo.length = 0; render(); }
  function load(value) { data = M.normalize(value); undo.length = 0; redo.length = 0; render(); }
  function insert(text) {
    const field = $('math-source');
    checkpoint();
    const start = field.selectionStart, end = field.selectionEnd;
    field.setRangeText(text, start, end, 'end');
    data.source = field.value;
    field.focus(); renderPreview(); mark();
  }
  function undoAction() { if (!undo.length) return; redo.push(JSON.stringify(data)); data = JSON.parse(undo.pop()); render(); mark(); }
  function redoAction() { if (!redo.length) return; undo.push(JSON.stringify(data)); data = JSON.parse(redo.pop()); render(); mark(); }
  function init(onChange) {
    changed = onChange;
    const palette = $('symbol-palette'); const grid = document.createElement('div'); grid.className = 'symbol-grid';
    symbols.forEach(([glyph, code]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = glyph; button.title = code; button.addEventListener('click', () => {
      const name = code.slice(1);
      const greek = /^(alpha|beta|gamma|delta|theta|lambda|pi|sigma|phi|omega)$/.test(name);
      insert(data.mode === 'starmath' ? (greek ? `%${name}` : name) : code);
    }); grid.append(button); });
    palette.append(grid);
    document.querySelectorAll('[data-snippet]').forEach(button => button.addEventListener('click', () => {
      const tex = button.dataset.snippet;
      const star = { '\\frac{a}{b}': '{a} over {b}', '\\sqrt{x}': 'sqrt {x}', '\\sum_{i=1}^{n}': 'sum from {i=1} to {n}', '\\int_{a}^{b}': 'int from {a} to {b}' };
      insert(data.mode === 'starmath' ? (star[tex] || tex) : tex);
    }));
    $('math-source').addEventListener('beforeinput', () => { if (Date.now() - lastCheckpoint > 500) { checkpoint(); lastCheckpoint = Date.now(); } });
    $('math-source').addEventListener('input', event => { data.source = event.target.value; renderPreview(); mark(); });
    $('input-mode').addEventListener('change', event => { checkpoint(); data.mode = event.target.value; renderPreview(); mark(); });
    $('math-size').addEventListener('change', event => { checkpoint(); data.size = Math.max(16, Math.min(100, Number(event.target.value) || 38)); renderPreview(); mark(); });
    $('undo-btn').addEventListener('click', undoAction); $('redo-btn').addEventListener('click', redoAction);
    window.addEventListener('keydown', event => {
      if (event.target.matches('textarea,input,[contenteditable]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undoAction(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redoAction(); }
    });
  }
  function importFile(name, content) {
    if (/\.json$/i.test(name)) { const source = JSON.parse(content); load(source.content || source); }
    else if (/\.tex$/i.test(name)) load({ source: content, mode: 'tex' });
    else if (/\.(mml|xml|odf)$/i.test(name)) { M.sanitizeMathML(content); load({ source: content, mode: 'mathml' }); }
    else throw new Error('Open TeX, MathML, ODF, or XMath JSON');
    return { title: name.replace(/\.[^.]+$/, '') };
  }
  async function exportFile(format, title) {
    if (format === 'odf') {
      const response = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, format, content: M.toMathML(data) }) });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || 'ODF export failed'); }
      return { data: await response.blob(), mime: 'application/vnd.oasis.opendocument.formula', filename: `${title}.odf` };
    }
    if (format === 'mml') return { data: M.toMathML(data), mime: 'application/mathml+xml', filename: `${title}.mml` };
    if (format === 'svg') return { data: M.toSvg(data), mime: 'image/svg+xml', filename: `${title}.svg` };
    if (format === 'tex') {
      if (data.mode === 'mathml') throw new Error('Switch to TeX or Math-style input before exporting TeX');
      return { data: data.mode === 'starmath' ? M.starToTex(data.source) : data.source, mime: 'text/plain;charset=utf-8', filename: `${title}.tex` };
    }
    if (format === 'json') return { data: JSON.stringify(data, null, 2), mime: 'application/json', filename: `${title}.json` };
    throw new Error('Unsupported formula export');
  }
  window.XEditor = { init, blank, load, snapshot: () => structuredClone(data), importFile, export: exportFile };
})();
