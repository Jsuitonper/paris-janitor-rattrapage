import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { Property } from '../api/types';
import { MoneyInput, PercentInput } from './inputs';

export type PropertyFormState = {
  title: string;
  description: string;
  street: string;
  postalCode: string;
  arrondissement: number;
  capacity: number;
  bedrooms: number;
  surfaceM2: number;
  amenities: string;
  nightlyRateHtCents: number;
  vatRateBps: number;
  blockedRanges: { start: string; end: string }[];
};

export const EMPTY_PROPERTY: PropertyFormState = { title: '', description: '', street: '', postalCode: '75001', arrondissement: 1, capacity: 2, bedrooms: 1, surfaceM2: 30, amenities: '', nightlyRateHtCents: 10000, vatRateBps: 1000, blockedRanges: [] };

export function propertyToForm(p: Property): PropertyFormState {
  return {
    title: p.title, description: p.description, street: p.address.street, postalCode: p.address.postalCode, arrondissement: p.address.arrondissement,
    capacity: p.capacity, bedrooms: p.bedrooms, surfaceM2: p.surfaceM2, amenities: p.amenities.join(', '), nightlyRateHtCents: p.nightlyRateHtCents,
    vatRateBps: p.vatRateBps, blockedRanges: p.blockedRanges.map((r) => ({ start: r.start.slice(0, 10), end: r.end.slice(0, 10) })),
  };
}

export function formToBody(f: PropertyFormState) {
  return {
    title: f.title,
    description: f.description,
    address: { street: f.street, postalCode: f.postalCode, city: 'Paris', arrondissement: f.arrondissement },
    capacity: f.capacity,
    bedrooms: f.bedrooms,
    surfaceM2: f.surfaceM2,
    amenities: f.amenities.split(',').map((a) => a.trim()).filter(Boolean),
    nightlyRateHtCents: f.nightlyRateHtCents,
    vatRateBps: f.vatRateBps,
    blockedRanges: f.blockedRanges,
  };
}

type Props = { form: PropertyFormState; onChange: (form: PropertyFormState) => void; onSubmit: () => void; editing: boolean; onCancel: () => void };

export function PropertyForm({ form, onChange, onSubmit, editing, onCancel }: Props) {
  const [range, setRange] = useState({ start: '', end: '' });
  const number = (key: keyof PropertyFormState) => (e: ChangeEvent<HTMLInputElement>) => onChange({ ...form, [key]: Number(e.target.value) });
  const text = (key: keyof PropertyFormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...form, [key]: e.target.value });

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{editing ? 'Modifier' : 'Nouveau bien'}</h2>
      <label>Titre<input value={form.title} onChange={text('title')} required /></label>
      <label>Description<textarea value={form.description} onChange={text('description')} rows={2} /></label>
      <label>Adresse<input value={form.street} onChange={text('street')} required /></label>
      <div className="row">
        <label>Code postal<input value={form.postalCode} onChange={text('postalCode')} required pattern="75[0-9]{3}" /></label>
        <label>Arrondissement<input type="number" min={1} max={20} value={form.arrondissement} onChange={number('arrondissement')} /></label>
      </div>
      <div className="row">
        <label>Capacité<input type="number" min={1} value={form.capacity} onChange={number('capacity')} /></label>
        <label>Chambres<input type="number" min={0} value={form.bedrooms} onChange={number('bedrooms')} /></label>
        <label>Surface (m²)<input type="number" min={5} value={form.surfaceM2} onChange={number('surfaceM2')} /></label>
      </div>
      <label>Équipements (séparés par des virgules)<input value={form.amenities} onChange={text('amenities')} /></label>
      <div className="row">
        <label>Nuitée (€ HT)<MoneyInput cents={form.nightlyRateHtCents} onChange={(nightlyRateHtCents) => onChange({ ...form, nightlyRateHtCents })} /></label>
        <label>TVA (%)<PercentInput bps={form.vatRateBps} onChange={(vatRateBps) => onChange({ ...form, vatRateBps })} /></label>
      </div>
      <p className="muted">Périodes indisponibles</p>
      {form.blockedRanges.map((r, i) => (
        <div className="row" key={i}>
          <span>{r.start} → {r.end}</span>
          <button type="button" className="secondary small" onClick={() => onChange({ ...form, blockedRanges: form.blockedRanges.filter((_, j) => j !== i) })}>Retirer</button>
        </div>
      ))}
      <div className="row">
        <input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        <input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        <button type="button" className="secondary small" disabled={!range.start || !range.end} onClick={() => { onChange({ ...form, blockedRanges: [...form.blockedRanges, range] }); setRange({ start: '', end: '' }); }}>Bloquer</button>
      </div>
      <div className="row">
        <button type="submit">{editing ? 'Enregistrer' : 'Créer (à valider)'}</button>
        {editing && <button type="button" className="secondary" onClick={onCancel}>Annuler</button>}
      </div>
    </form>
  );
}
