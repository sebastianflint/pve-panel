// Runs in the browser: checks the contrast of every visible text on the page
// against the background it is actually drawn on (WCAG 2.x formula).
// Returns the texts below 4.5:1 (3:1 for large text). Disabled controls are
// skipped (WCAG exempts inactive components).
(() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // any CSS color (incl. color-mix, oklab) -> [r, g, b, a]
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const blend = (top, under) => top.slice(0, 3).map((c, i) => c * top[3] + under[i] * (1 - top[3]));
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  // background actually behind an element: blend backgrounds up the tree
  const backgroundOf = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let bg = rgba(getComputedStyle(document.documentElement).backgroundColor);
    if (bg[3] < 1) bg = [255, 255, 255, 1];
    for (const l of layers.reverse()) bg = [...blend(l, bg), 1];
    return bg;
  };
  const inactive = (el) => el.closest('[disabled], [aria-disabled="true"], [hidden], .disabled') !== null;

  const problems = [];
  const seen = new Set();
  const rate = (el, color, text, kind) => {
    const st = getComputedStyle(el);
    const bg = backgroundOf(el);
    const fg = blend(rgba(color), bg);
    const size = parseFloat(st.fontSize);
    const large = size >= 24 || (parseInt(st.fontWeight, 10) >= 700 && size >= 18.66);
    const need = large ? 3 : 4.5;
    const r = ratio(fg, bg);
    if (r < need) problems.push({ text: `${kind}${text}`.slice(0, 50), ratio: Math.round(r * 100) / 100, need, tag: el.tagName.toLowerCase() });
  };

  // Form fields: their content and placeholder are not text nodes, check them separately
  for (const el of document.querySelectorAll('input, select, textarea')) {
    const st = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (st.visibility !== 'visible' || st.display === 'none' || box.width === 0 || box.height === 0) continue;
    if (['checkbox', 'radio', 'hidden', 'range', 'color', 'file'].includes(el.type)) continue;
    if (el.disabled || el.closest('[hidden]') || parseFloat(st.opacity) < 1) continue;
    const label = el.name || el.id || el.tagName.toLowerCase();
    const value = el.tagName === 'SELECT' ? el.options[el.selectedIndex]?.text : el.value;
    if (value) rate(el, st.color, `[${label}] `, 'field: ');
    if (el.placeholder) rate(el, getComputedStyle(el, '::placeholder').color, `[${label}] ${el.placeholder}`, 'placeholder: ');
  }

  for (const el of document.querySelectorAll('body *')) {
    if (seen.has(el)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;
    const st = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (st.visibility !== 'visible' || st.display === 'none' || box.width === 0 || box.height === 0) continue;
    if (inactive(el) || parseFloat(st.opacity) < 1) continue;
    seen.add(el);
    const fg = rgba(st.color);
    const bg = backgroundOf(el);
    const effectiveFg = blend(fg, bg);
    const size = parseFloat(st.fontSize);
    const bold = parseInt(st.fontWeight, 10) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const r = ratio(effectiveFg, bg);
    if (r < need) {
      problems.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(r * 100) / 100, need, tag: el.tagName.toLowerCase(), cls: el.className?.toString().slice(0, 40) });
    }
  }
  return problems;
})();
