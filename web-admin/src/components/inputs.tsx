import { useEffect, useState } from 'react';
import { bpsToPercent, centsToEuros, eurosToCents, percentToBps } from '../lib/money';

type MoneyInputProps = { cents: number; onChange: (cents: number) => void; required?: boolean };

export function MoneyInput({ cents, onChange, required }: MoneyInputProps) {
  const [text, setText] = useState(centsToEuros(cents));

  useEffect(() => {
    if (eurosToCents(text) !== cents) {
      setText(centsToEuros(cents));
    }
  }, [cents, text]);

  return (
    <input
      inputMode="decimal"
      value={text}
      required={required}
      onChange={(e) => {
        setText(e.target.value);
        onChange(eurosToCents(e.target.value));
      }}
    />
  );
}

type PercentInputProps = { bps: number; onChange: (bps: number) => void };

export function PercentInput({ bps, onChange }: PercentInputProps) {
  const [text, setText] = useState(bpsToPercent(bps));

  useEffect(() => {
    if (percentToBps(text) !== bps) {
      setText(bpsToPercent(bps));
    }
  }, [bps, text]);

  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(percentToBps(e.target.value));
      }}
    />
  );
}

type OptionalNumberInputProps = { value: number | null; onChange: (value: number | null) => void; placeholder?: string };

export function OptionalNumberInput({ value, onChange, placeholder }: OptionalNumberInputProps) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}
