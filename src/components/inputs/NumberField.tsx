import { useEffect, useId, useState } from 'react';

interface Props {
  label: string;
  symbol?: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  slider?: { min: number; max: number; step?: number };
  integer?: boolean;
  disabled?: boolean;
  title?: string;
}

/** Labelled numeric input with unit and optional slider. Commits valid numbers as you type. */
export function NumberField({ label, symbol, unit, value, onChange, min, max, step, slider, integer, disabled, title }: Props) {
  const id = useId();
  const [text, setText] = useState(() => format(value));
  useEffect(() => {
    if (Number(text) !== value) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (s: string) => {
    setText(s);
    const v = Number(s);
    if (s.trim() === '' || !Number.isFinite(v)) return;
    let x = integer ? Math.round(v) : v;
    if (min !== undefined && x < min) return;
    if (max !== undefined && x > max) x = max;
    onChange(x);
  };

  return (
    <div className={`field${slider ? ' with-slider' : ''}`} title={title}>
      <label className="label" htmlFor={id}>
        <span>{label}</span>
        {symbol && <em>{symbol}</em>}
      </label>
      <input
        id={id}
        className="input num"
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step ?? 'any'}
        disabled={disabled}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setText(format(value))}
      />
      <span className="unit">{unit}</span>
      {slider && (
        <input
          className="slider"
          type="range"
          aria-label={`${label} slider`}
          min={slider.min}
          max={slider.max}
          step={slider.step ?? (slider.max - slider.min) / 200}
          value={value}
          disabled={disabled}
          onChange={(e) => commit(e.target.value)}
        />
      )}
    </div>
  );
}

function format(v: number) {
  if (!Number.isFinite(v)) return '';
  return String(+v.toPrecision(8));
}

export function ReadField({ label, symbol, value, unit }: { label: string; symbol?: string; value: string; unit?: string }) {
  return (
    <div className="field readonly">
      <div className="label">
        <span>{label}</span>
        {symbol && <em>{symbol}</em>}
      </div>
      <div className="value">{value}</div>
      <span className="unit">{unit}</span>
    </div>
  );
}
