import { useEffect, useState } from 'react';
import { api, downloadBlob, saveBlob } from '../api/client';
import type { QuoteLead } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatEuros } from '../lib/money';

const STATUS_LABELS: Record<QuoteLead['status'], string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  converted: 'Converti',
  archived: 'Archivé',
};

const BADGES: Record<QuoteLead['status'], string> = {
  new: 'pending',
  contacted: '',
  converted: 'published',
  archived: 'rejected',
};

export function LeadsPage() {
  const { token } = useAuth();
  const [leads, setLeads] = useState<QuoteLead[]>([]);
  const [status, setStatus] = useState<'' | QuoteLead['status']>('');
  const [withContact, setWithContact] = useState<'' | 'true' | 'false'>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (withContact) params.set('withContact', withContact);
    const query = params.toString();
    api<QuoteLead[]>('/admin/leads' + (query ? '?' + query : ''), { token })
      .then(setLeads)
      .catch(showError);
  }

  useEffect(load, [token, status, withContact]);

  async function qualify(lead: QuoteLead, patch: { status?: QuoteLead['status']; notes?: string }) {
    setError(null);
    try {
      await api('/admin/leads/' + lead.id, { method: 'PATCH', body: patch, token });
      load();
    } catch (err) {
      showError(err);
    }
  }

  async function exportCsv() {
    setError(null);
    try {
      saveBlob(await downloadBlob('/admin/leads/export.csv', token), 'leads-paris-janitor.csv');
    } catch (err) {
      showError(err);
    }
  }

  return (
    <>
      <h1>Demandes de simulation</h1>
      <p className="muted">
        Chaque simulation du formulaire public est enregistrée. Les coordonnées n’apparaissent que si le visiteur les a laissées.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="row">
        <label>
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value as '' | QuoteLead['status'])}>
            <option value="">Tous</option>
            <option value="new">Nouveaux</option>
            <option value="contacted">Contactés</option>
            <option value="converted">Convertis</option>
            <option value="archived">Archivés</option>
          </select>
        </label>
        <label>
          Coordonnées
          <select value={withContact} onChange={(e) => setWithContact(e.target.value as '' | 'true' | 'false')}>
            <option value="">Toutes</option>
            <option value="true">Avec coordonnées</option>
            <option value="false">Anonymes</option>
          </select>
        </label>
        <button type="button" className="secondary" onClick={exportCsv}>
          Exporter en CSV
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Contact</th>
            <th>Logement</th>
            <th>Nuitée / occupation</th>
            <th>Net annuel estimé</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>{new Date(lead.createdAt).toLocaleDateString('fr-FR')}</td>
              <td>
                {lead.contact ? (
                  <>
                    {lead.contact.firstName} {lead.contact.lastName}
                    <div className="muted">
                      {lead.contact.email}
                      {lead.contact.phone && ' · ' + lead.contact.phone}
                    </div>
                  </>
                ) : (
                  <span className="muted">anonyme</span>
                )}
              </td>
              <td>
                Paris {lead.input.arrondissement}e · {lead.input.surfaceM2} m² · {lead.input.capacity} voyageurs
              </td>
              <td>
                {formatEuros(lead.input.nightlyRateHtCents)} · {lead.input.occupancyRateBps / 100} %
                <div className="muted">{lead.breakdown.assumptions.occupiedNights} nuits</div>
              </td>
              <td>
                <strong>{formatEuros(lead.breakdown.net.yearlyHtCents)}</strong>
                {expanded === lead.id && (
                  <div className="muted">
                    brut {formatEuros(lead.breakdown.grossRevenueHtCents)} · commission −
                    {formatEuros(lead.breakdown.charges.platformCommissionHtCents)} · abonnement −
                    {formatEuros(lead.breakdown.charges.ownerYearlyFeeCents)}
                    {lead.breakdown.charges.optionsHtCents > 0 && ' · options −' + formatEuros(lead.breakdown.charges.optionsHtCents)}
                  </div>
                )}
              </td>
              <td>
                <span className={'badge ' + BADGES[lead.status]}>{STATUS_LABELS[lead.status]}</span>
                {lead.notes && <div className="muted">{lead.notes}</div>}
              </td>
              <td className="row">
                <select value={lead.status} onChange={(e) => qualify(lead, { status: e.target.value as QuoteLead['status'] })}>
                  {(Object.keys(STATUS_LABELS) as QuoteLead['status'][]).map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => qualify(lead, { notes: window.prompt('Note de suivi', lead.notes) ?? lead.notes })}
                >
                  Note
                </button>
                <button type="button" className="secondary small" onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}>
                  Détail
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
