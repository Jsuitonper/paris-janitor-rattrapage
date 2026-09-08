export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}
