import { useEffect, useRef, useState, type PointerEvent } from 'react';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Wheel-zoom (about the cursor) and drag-pan for an SVG viewBox. */
export function useZoomPan(base: ViewBox) {
  const [vb, setVb] = useState(base);
  const drag = useRef<{ x: number; y: number; vb: ViewBox } | null>(null);
  const [panning, setPanning] = useState(false);
  const key = `${base.x}|${base.y}|${base.w}|${base.h}`;
  useEffect(() => setVb(base), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Native non-passive wheel listener so the page does not scroll while zooming the drawing.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const baseRef = useRef(base);
  baseRef.current = base;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const k = Math.exp(e.deltaY * 0.0015);
      setVb((v) => {
        const px = v.x + ((e.clientX - r.left) / r.width) * v.w;
        const py = v.y + ((e.clientY - r.top) / r.height) * v.h;
        const b = baseRef.current;
        const w = Math.min(b.w * 1.5, Math.max(b.w / 60, v.w * k));
        const h = (w / v.w) * v.h;
        return { x: px - ((px - v.x) * w) / v.w, y: py - ((py - v.y) * h) / v.h, w, h };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, vb };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    setVb({ ...d.vb, x: d.vb.x - ((e.clientX - d.x) / r.width) * d.vb.w, y: d.vb.y - ((e.clientY - d.y) / r.height) * d.vb.h });
  };
  const onPointerUp = () => {
    drag.current = null;
    setPanning(false);
  };
  const zoom = (k: number) =>
    setVb((v) => {
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      return { x: cx - (v.w * k) / 2, y: cy - (v.h * k) / 2, w: v.w * k, h: v.h * k };
    });
  const reset = () => setVb(base);
  const focus = (target: ViewBox) => setVb(target);

  return {
    viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`,
    vb,
    panning,
    svgRef,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerLeave: onPointerUp },
    zoom,
    reset,
    focus,
    scale: base.w / vb.w,
  };
}
