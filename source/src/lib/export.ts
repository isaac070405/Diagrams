// Sheet export: SVG with computed styles inlined, rendered on Paper; PNG/JPEG at 3×.
const PROPS = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
  'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order', 'text-transform', 'visibility', 'display',
  'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask', 'stop-color', 'stop-opacity', 'vector-effect'];

export const EXPORT_SCALE = 3;

export function sheetSvg(svg: SVGSVGElement): { text: string; w: number; h: number } {
  const host = document.createElement('div');
  host.setAttribute('data-theme', 'paper');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;opacity:0;pointer-events:none';
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-export="skip"]').forEach(n => n.remove());
  host.appendChild(clone);
  document.body.appendChild(host);
  try {
    const all = [clone as Element, ...Array.from(clone.querySelectorAll('*'))];
    for (const el of all) {
      if (el.tagName === 'title' || el.tagName === 'style') continue;
      const cs = getComputedStyle(el);
      const st: string[] = [];
      for (const p of PROPS) {
        let v = cs.getPropertyValue(p);
        if (!v) continue;
        if (p.startsWith('marker') || p === 'clip-path' || p === 'mask') {
          if (v === 'none') continue;
          v = v.replace(/url\((["']?)[^#)"']*#/g, 'url($1#');
        }
        if (p === 'text-transform' && v === 'none') continue;
        if (p === 'display' && v !== 'none') continue;
        st.push(p + ':' + v);
      }
      const tr = cs.getPropertyValue('translate');
      if (tr && tr !== 'none' && tr !== '0px') {
        const [tx, ty] = tr.split(/\s+/).map(v => parseFloat(v) || 0);
        el.setAttribute('transform', 'translate(' + tx + ' ' + ty + ') ' + (el.getAttribute('transform') || ''));
      }
      el.setAttribute('style', st.join(';'));
      el.removeAttribute('class');
    }
    clone.removeAttribute('class');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const vb = (clone.getAttribute('viewBox') || '0 0 800 450').split(/[ ,]+/).map(Number);
    clone.setAttribute('width', String(vb[2])); clone.setAttribute('height', String(vb[3]));
    clone.style.removeProperty('max-width');
    return { text: new XMLSerializer().serializeToString(clone), w: vb[2], h: vb[3] };
  } finally { host.remove(); }
}

export function svgBlob(svg: SVGSVGElement, bg?: string): Blob {
  let { text } = sheetSvg(svg);
  if (bg) text = text.replace(/(<svg[^>]*>)/, '$1<rect x="-1e5" y="-1e5" width="2e5" height="2e5" fill="' + bg + '"/>');
  return new Blob([text], { type: 'image/svg+xml' });
}

export function rasterBlob(svg: SVGSVGElement, type: 'image/png' | 'image/jpeg', bg: string | null): Promise<Blob> {
  const { text, w, h } = sheetSvg(svg);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * EXPORT_SCALE); c.height = Math.round(h * EXPORT_SCALE);
      const x = c.getContext('2d')!;
      if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('encode')), type, 0.95);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('render')); };
    im.src = url;
  });
}

export function slug(s: string, fallback: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
}
