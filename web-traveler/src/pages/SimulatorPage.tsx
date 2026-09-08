import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { SimulationBreakdown, SimulatorOption } from '../api/types';
import { formatEuros } from '../lib/money';

type Form = {
  arrondissement: number;
  surfaceM2: number;
  capacity: number;
  bedrooms: number;
  nightlyRateHtCents: number;
  occupancyRateBps: number;
  averageStayNights: number;
  optionKeys: string[];
};

const EMPTY: Form = {
  arrondissement: 2,
  surfaceM2: 30,
  capacity: 2,
  bedrooms: 1,
  nightlyRateHtCents: 12000,
  occupancyRateBps: 6000,
  averageStayNights: 3,
  optionKeys: [],
};

const EMPTY_CONTACT = { firstName: '', lastName: '', email: '', phone: '' };

export function SimulatorPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [options, setOptions] = useState<SimulatorOption[]>([]);
  const [breakdown, setBreakdown] = useState<SimulationBreakdown | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [contactSent, setContactSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SimulatorOption[]>('/simulator/options').then(setOptions).catch(() => setOptions([]));
  }, []);

  async function simulate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await api<{ leadId: string; breakdown: SimulationBreakdown }>('/simulator/simulate', {
        method: 'POST',
        body: form,
      });
      setBreakdown(result.breakdown);
      setLeadId(result.leadId);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation impossible');
    }
  }

  async function sendContact(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/simulator/leads/' + leadId + '/contact', { method: 'POST', body: contact });
      setContactSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    }
  }

  function restart() {
    setForm(EMPTY);
    setBreakdown(null);
    setLeadId(null);
    setContact(EMPTY_CONTACT);
    setContactSent(false);
    setStep(1);
  }

  function toggleOption(key: string) {
    setForm({
      ...form,
      optionKeys: form.optionKeys.includes(key) ? form.optionKeys.filter((item) => item !== key) : [...form.optionKeys, key],
    });
  }

  return (
    <>
      <h1>Combien peut rapporter votre logement ?</h1>
      <p className="muted">
        Estimation annuelle en trois étapes, avec le détail de chaque ligne. Aucun engagement, aucune inscription.
      </p>
      {error && <p className="error">{error}</p>}

      <p className="muted">Étape {Math.min(step, 3)} sur 3</p>

      {step === 1 && (
        <section className="card">
          <h3>1. Votre logement</h3>
          <div className="row">
            <label>
              Arrondissement
              <select value={form.arrondissement} onChange={(e) => setForm({ ...form, arrondissement: Number(e.target.value) })}>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Paris {n}e
                  </option>
                ))}
              </select>
            </label>
            <label>
              Surface (m²)
              <input type="number" min={5} max={2000} value={form.surfaceM2} onChange={(e) => setForm({ ...form, surfaceM2: Number(e.target.value) })} />
            </label>
            <label>
              Voyageurs
              <input type="number" min={1} max={30} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </label>
            <label>
              Chambres
              <input type="number" min={0} max={20} value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: Number(e.target.value) })} />
            </label>
          </div>
          <button type="button" onClick={() => setStep(2)}>
            Continuer
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <h3>2. Tarif et occupation</h3>
          <label>
            Prix visé par nuit (€ HT)
            <input
              type="number"
              min={10}
              step={1}
              value={Math.round(form.nightlyRateHtCents / 100)}
              onChange={(e) => setForm({ ...form, nightlyRateHtCents: Math.round(Number(e.target.value) * 100) })}
            />
          </label>
          <label>
            Taux d’occupation : <strong>{form.occupancyRateBps / 100} %</strong> soit {Math.round((365 * form.occupancyRateBps) / 10000)} nuits par an
            <input
              type="range"
              min={0}
              max={10000}
              step={500}
              value={form.occupancyRateBps}
              onChange={(e) => setForm({ ...form, occupancyRateBps: Number(e.target.value) })}
            />
          </label>
          <label>
            Durée moyenne d’un séjour (nuits)
            <input type="number" min={1} max={365} value={form.averageStayNights} onChange={(e) => setForm({ ...form, averageStayNights: Number(e.target.value) })} />
          </label>
          <div className="row">
            <button type="button" className="secondary" onClick={() => setStep(1)}>
              Retour
            </button>
            <button type="button" onClick={() => setStep(3)}>
              Continuer
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <form className="card" onSubmit={simulate}>
          <h3>3. Services de conciergerie souhaités</h3>
          {options.map((option) => (
            <label key={option.key} className="inline">
              <input type="checkbox" checked={form.optionKeys.includes(option.key)} onChange={() => toggleOption(option.key)} />
              {option.label} — {formatEuros(option.priceHtCents)} HT {option.frequency === 'per_stay' ? 'par séjour' : 'par an'}
            </label>
          ))}
          <div className="row">
            <button type="button" className="secondary" onClick={() => setStep(2)}>
              Retour
            </button>
            <button type="submit">Calculer mes gains</button>
          </div>
        </form>
      )}

      {step === 4 && breakdown && (
        <>
          <section className="card">
            <h3>Votre estimation annuelle</h3>
            <p className="muted">
              Sur la base de {breakdown.assumptions.occupiedNights} nuits occupées ({breakdown.assumptions.occupancyRateBps / 100} %),
              soit environ {breakdown.assumptions.estimatedStays} séjours de {breakdown.assumptions.averageStayNights} nuits.
            </p>
            <div className="breakdown">
              <span>
                Revenu brut ({breakdown.assumptions.occupiedNights} nuits × {formatEuros(breakdown.assumptions.nightlyRateHtCents)})
              </span>
              <span>{formatEuros(breakdown.grossRevenueHtCents)}</span>

              <span>Commission Paris Janitor ({breakdown.assumptions.commissionBps / 100} %)</span>
              <span>−{formatEuros(breakdown.charges.platformCommissionHtCents)}</span>

              <span>Abonnement annuel</span>
              <span>−{formatEuros(breakdown.charges.ownerYearlyFeeCents)}</span>

              {breakdown.charges.options.map((option) => (
                <span key={option.key} style={{ display: 'contents' }}>
                  <span>
                    {option.label} ({option.quantity} × {formatEuros(option.unitPriceHtCents)})
                  </span>
                  <span>−{formatEuros(option.totalHtCents)}</span>
                </span>
              ))}

              <span className="total">Revenu net annuel HT</span>
              <span className="total">{formatEuros(breakdown.net.yearlyHtCents)}</span>
            </div>
            <p>
              Soit <strong>{formatEuros(breakdown.net.monthlyHtCents)}</strong> par mois, ou{' '}
              <strong>{formatEuros(breakdown.net.perOccupiedNightHtCents)}</strong> par nuit occupée.
            </p>
            <button type="button" className="secondary" onClick={restart}>
              Refaire une simulation
            </button>
          </section>

          <section className="card">
            <h3>Être rappelé par un conseiller</h3>
            {contactSent ? (
              <p className="muted">Merci, votre demande est enregistrée. Un conseiller Paris Janitor vous recontacte sous 48 heures.</p>
            ) : (
              <form onSubmit={sendContact}>
                <div className="row">
                  <label>
                    Prénom
                    <input value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} required />
                  </label>
                  <label>
                    Nom
                    <input value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} required />
                  </label>
                </div>
                <div className="row">
                  <label>
                    E-mail
                    <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} required />
                  </label>
                  <label>
                    Téléphone
                    <input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                  </label>
                </div>
                <button type="submit">Envoyer ma demande</button>
              </form>
            )}
          </section>
        </>
      )}
    </>
  );
}
