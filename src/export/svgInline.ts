const PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linejoin',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'fill-rule',
  'font-size',
  'font-weight',
  'text-anchor',
  'visibility',
  'display',
];

/**
 * Clone an on-screen SVG with every CSS custom property resolved into presentation attributes,
 * so that vector converters (svg2pdf) reproduce it faithfully.
 */
export function inlineSvg(svg: SVGSVGElement, fontFamily: string): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const dst = [clone, ...Array.from(clone.querySelectorAll('*'))];
  src.forEach((el, i) => {
    const d = dst[i] as SVGElement;
    const cs = getComputedStyle(el);
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) d.setAttribute(p, v);
    }
    d.removeAttribute('style');
    d.removeAttribute('class');
    if (el.tagName === 'text' || el.tagName === 'tspan') {
      d.setAttribute('font-family', fontFamily);
      d.removeAttribute('paint-order');
      // halo strokes are a screen nicety; drop them in print
      if (d.getAttribute('stroke-width') && el.getAttribute('paint-order')) d.setAttribute('stroke', 'none');
    }
  });
  const vb = svg.viewBox.baseVal;
  const box = svg.getBoundingClientRect();
  clone.setAttribute('width', String(box.width || vb.width));
  clone.setAttribute('height', String(box.height || vb.height));
  return clone;
}
