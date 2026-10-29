import { useId } from 'react';

interface Props<T extends string | number> {
  label: string;
  symbol?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  unit?: string;
}

export function SelectField<T extends string | number>({ label, symbol, value, options, onChange, unit }: Props<T>) {
  const id = useId();
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        <span>{label}</span>
        {symbol && <em>{symbol}</em>}
      </label>
      <select
        id={id}
        className="select"
        value={String(value)}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="unit">{unit}</span>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
