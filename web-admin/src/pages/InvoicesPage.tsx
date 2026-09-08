import { useEffect, useState } from 'react';
import { api, downloadBlob, saveBlob } from '../api/client';
import type { Invoice, User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatEuros } from '../lib/money';

const now = new Date();

export function InvoicesPage() {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'' | 'traveler' | 'provider'>('');
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setMessage(null);
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function load() {
    api<Invoice[]>('/admin/invoices' + (filter ? '?type=' + filter : ''), { token })
      .then(setInvoices)
      .catch(showError);
  }

  useEffect(load, [token, filter]);

  useEffect(() => {
    api<User[]>('/admin/users', { token }).then(setUsers).catch(() => undefined);
  }, [token]);

  async function generate() {
    setError(null);
    try {
      const result = await api<{ created: Invoice[]; skipped: string[] }>('/admin/invoices/provider-payouts', {
        method: 'POST',
        body: { year, month },
        token,
      });
      setMessage(result.created.length + ' facture(s) prestataire émise(s), ' + result.skipped.length + ' déjà existante(s).');
      load();
    } catch (err) {
      showError(err);
    }
  }

  async function togglePayout(invoice: Invoice) {
    setError(null);
    try {
      await api('/admin/invoices/' + invoice.id + '/payout', {
        method: 'PATCH',
        body: { payoutStatus: invoice.payoutStatus === 'sent' ? 'pending' : 'sent' },
        token,
      });
      load();
    } catch (err) {
      showError(err);
    }
  }

  async function download(invoice: Invoice) {
    setError(null);
    try {
      saveBlob(await downloadBlob('/files/' + invoice.gridFsId, token), invoice.number + '.pdf');
    } catch (err) {
      showError(err);
    }
  }

  const emailOf = (id: string | null) => (id ? (users.find((u) => u.id === id)?.email ?? id) : '—');

  return (
    <>
      <h1>Factures</h1>
      <p className="muted">
        Les PDF sont générés une seule fois à l’émission et archivés en GridFS. Les montants proviennent des snapshots de réservation.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <section className="card">
        <h2>Facturation prestataire mensuelle</h2>
        <div className="row">
          <label>
            Année
            <input type="number" min={2018} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </label>
          <label>
            Mois
            <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          </label>
          <button type="button" onClick={generate}>
            Générer les factures du mois
          </button>
        </div>
      </section>

      <div className="row">
        <label>
          Filtrer
          <select value={filter} onChange={(e) => setFilter(e.target.value as '' | 'traveler' | 'provider')}>
            <option value="">Toutes</option>
            <option value="traveler">Voyageurs</option>
            <option value="provider">Prestataires</option>
          </select>
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Numéro</th>
            <th>Type</th>
            <th>Destinataire</th>
            <th>Période</th>
            <th>Lignes</th>
            <th>Montant</th>
            <th>Virement</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <code>{invoice.number}</code>
              </td>
              <td>{invoice.type === 'traveler' ? 'Voyageur' : 'Prestataire'}</td>
              <td>{invoice.type === 'traveler' ? emailOf(invoice.travelerId) : invoice.party.name}</td>
              <td>{invoice.period ? invoice.period.month + '/' + invoice.period.year : new Date(invoice.issuedAt).toLocaleDateString('fr-FR')}</td>
              <td>{invoice.lines.length}</td>
              <td>
                {invoice.type === 'traveler'
                  ? formatEuros(invoice.totals.totalTtcCents) + ' TTC'
                  : formatEuros(invoice.totals.providerNetHtCents) + ' HT net'}
              </td>
              <td>
                {invoice.payoutStatus === 'not_applicable' ? (
                  <span className="muted">—</span>
                ) : (
                  <button type="button" className={invoice.payoutStatus === 'sent' ? 'small' : 'secondary small'} onClick={() => togglePayout(invoice)}>
                    {invoice.payoutStatus === 'sent' ? 'Virement envoyé' : 'À virer'}
                  </button>
                )}
              </td>
              <td>
                <button type="button" className="secondary small" onClick={() => download(invoice)}>
                  PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
