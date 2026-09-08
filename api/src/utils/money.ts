export function assertCents(value: number, label = 'amount'): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} doit être un entier en centimes, reçu ${value}`);
  }
}

export function bpsOf(amountCents: number, bps: number): number {
  assertCents(amountCents, 'amountCents');
  assertCents(bps, 'bps');
  return Math.round((amountCents * bps) / 10000);
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => {
    assertCents(value);
    return total + value;
  }, 0);
}
